"use client";

import { Box, VStack, Text, HStack, Span } from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

type TranscriptItem = {
  time?: string;   // "HH:MM:SS.mmm"
  speaker?: string;
  text: string;
};

// map speakers → voices (replace with yours)
const SPEAKER_TO_VOICE: Record<string, string> = {
  PlayByPlay: "JBFqnCBsd6RMkjVDRZzb",
  Color: "EXAVITQu4vr4xnSDxMaL",
};

// ---------- utils ----------
function parseTimestamp(ts: string): number {
  const m = ts.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) throw new Error(`Bad timestamp "${ts}" (use HH:MM:SS.mmm)`);
  const [, HH, MM, SS, mmm] = m;
  return (
    parseInt(HH, 10) * 3600 +
    parseInt(MM, 10) * 60 +
    parseInt(SS, 10) +
    (mmm ? parseInt(mmm.padEnd(3, "0").slice(0, 3), 10) / 1000 : 0)
  );
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 400;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      const msg = String(e?.message || e || "");
      const retryable = /429|5\d\d|rate|timeout|network/i.test(msg);
      if (!retryable || i === tries - 1) throw e;
      const jitter = Math.floor(Math.random() * 200);
      await wait(delay + jitter);
      delay = Math.min(delay * 2, 4000);
    }
  }
  throw new Error("Retry failed");
}

async function runQueue<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency = 1 // conservative; try 2 if stable
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      out[i] = await worker(items[i], i);
      await wait(250); // pacing
    }
  });
  await Promise.all(runners);
  return out;
}

async function fetchAudioArrayBuffer(payload: {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
}): Promise<ArrayBuffer> {
  const res = await fetch("/api/elevenlabs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`TTS ${res.status}: ${detail}`);
  }
  if (!ct.startsWith("audio/")) {
    const detail = await res.text();
    throw new Error(`TTS non-audio response: ${detail}`);
  }
  return await res.arrayBuffer();
}

// Safari-safe decode wrapper (callback form)
function decodeBuffer(ctx: AudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  if (!ab || ab.byteLength < 100) {
    return Promise.reject(new Error("TTS returned too-small audio blob"));
  }
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(ab.slice(0), resolve, reject);
  });
}

function Hero() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);

  function stopAll() {
    scheduledNodesRef.current.forEach(n => { try { n.stop(); } catch {} });
    scheduledNodesRef.current = [];
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    setSpeaking(false);
  }

  async function handleGenerate() {
    if (speaking) return;

    try {
      const raw = textareaRef.current?.value ?? "";
      if (!raw.trim()) {
        alert("Paste a JSON transcript first.");
        return;
      }

      // Parse
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error("JSON must be an array.");
      const items: TranscriptItem[] = data.map((row: any, i: number) => {
        if (!row || typeof row !== "object") throw new Error(`Item ${i + 1} is not an object.`);
        const text = row.text;
        if (typeof text !== "string" || !text.trim()) throw new Error(`Item ${i + 1} missing non-empty "text".`);
        const item: TranscriptItem = { text: text.trim() };
        if (typeof row.speaker === "string") item.speaker = row.speaker;
        if (typeof row.time === "string") item.time = row.time;
        return item;
      });

      setSpeaking(true);

      // Fallback: no timestamps → sequential via <audio> (no decoding needed)
      const anyTimed = items.some(it => it.time && it.time.trim());
      if (!anyTimed) {
        for (const it of items) {
          const ab = await withRetry(() =>
            fetchAudioArrayBuffer({
              text: it.text.length > 2800 ? it.text.slice(0, 2800) : it.text,
              voiceId: it.speaker ? SPEAKER_TO_VOICE[it.speaker] : undefined,
              // can be mp3 or wav; <audio> handles either
              outputFormat: "mp3_44100_128"
            })
          );
          const url = URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
          await new Promise<void>((resolve, reject) => {
            const a = new Audio(url);
            a.onended = () => { URL.revokeObjectURL(url); resolve(); };
            a.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Playback failed")); };
            a.play().catch(reject);
          });
          await wait(150);
        }
        setSpeaking(false);
        return;
      }

      // Timestamped playback → Web Audio (WAV + callback decode)
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const gain = ctx.createGain();
      gain.gain.value = 1;
      gain.connect(ctx.destination);

      // times
      const timesSec: (number | null)[] = items.map(it => it.time ? parseTimestamp(it.time) : null);
      const provided = timesSec.filter((t): t is number => t !== null);
      const t0 = provided.length ? Math.min(...provided) : 0;

      // fetch WAV with queue+retry
      const arrayBuffers = await runQueue(
        items,
        (it) => withRetry(() =>
          fetchAudioArrayBuffer({
            text: it.text.length > 2800 ? it.text.slice(0, 2800) : it.text,
            voiceId: it.speaker ? SPEAKER_TO_VOICE[it.speaker] : undefined,
            outputFormat: "wav" // << IMPORTANT for decodeAudioData
          })
        ),
        1
      );

      // decode (callback form)
      const buffers = await runQueue(
        arrayBuffers,
        (ab) => withRetry(() => decodeBuffer(ctx, ab)),
        1
      );

      // fill missing times after previous end
      for (let i = 0; i < items.length; i++) {
        if (timesSec[i] == null) {
          if (i === 0) timesSec[i] = t0;
          else timesSec[i] = timesSec[i - 1]! + buffers[i - 1].duration;
        }
      }

      // nudge exact overlaps
      const epsilon = 0.04;
      for (let i = 1; i < timesSec.length; i++) {
        if ((timesSec[i] as number) <= (timesSec[i - 1] as number) + 1e-6) {
          timesSec[i] = (timesSec[i - 1] as number) + epsilon;
        }
      }

      // schedule
      const now = ctx.currentTime;
      const base = now + 0.08;
      scheduledNodesRef.current = [];
      buffers.forEach((buf, i) => {
        const startAt = base + (timesSec[i]! - t0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start(startAt);
        scheduledNodesRef.current.push(src);
      });

      await new Promise<void>((resolve) => {
        const last = scheduledNodesRef.current[scheduledNodesRef.current.length - 1];
        last.onended = () => resolve();
      });

    } catch (e: any) {
      console.error(e);
      alert(`Couldn't play transcript:\n${e?.message ?? String(e)}`);
    } finally {
      stopAll();
    }
  }

  return (
    <>
      <VStack mt="25px" justify="center" align="center" w="100%" textAlign="center" px={["4%", "4%", "6%", "6%", "6%", "10%"]} />

      <HStack
        px={["4%", "4%", "6%", "6%", "6%", "10%"]}
        mt="10px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        w="100%"
        spacing={["16px", "16px", "20px", "24px", "24px", "32px"]}
        flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
        gap={["16px", "16px", "20px", "24px", "24px", "32px"]}
      >
        {/* Left: JSON input */}
        <Box position="relative" h={["340px","360px","380px","500px","520px","560px"]} w={["95%","95%","95%","600px","600px","600px"]} borderRadius="24px" overflow="hidden" display="flex" justifyContent="end">
          <Box position="relative" h="100%" w="100%" borderRadius="24px" overflow="hidden">
            <HStack as="header" w="100%" justify="space-between" align="center" px="16px" py="10px" borderBottomWidth="1px" borderColor="gray.300" bg="white">
              <Text fontFamily="poppins" fontWeight={600} color="black" fontSize="14px">JSON mode · timestamps supported</Text>
              <Text fontFamily="poppins" color="gray.600" fontSize="12px">Example keys: <Span as="span" color="black">time, speaker, text</Span></Text>
            </HStack>

            <Box p="16px" h="100%">
              <Box
                as="textarea"
                ref={textareaRef}
                aria-label="Paste JSON with timestamps"
                placeholder={`[
  { "time": "00:00:03.250", "speaker": "PlayByPlay", "text": "Welcome to the season opener!" },
  { "time": "00:00:05.000", "speaker": "Color",      "text": "You can feel the tempo picking up." },
  { "time": "00:00:08.400", "speaker": "PlayByPlay", "text": "Tip-off… Tigers control the ball." },
  { "time": "00:00:10.000", "speaker": "Color",      "text": "Watch the corner — shooter is open." }
]`}
                spellCheck={false}
                wrap="off"
                resize="none"
                fontFamily="mono"
                fontSize="13px"
                lineHeight="1.6"
                bg="white"
                color="black"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="12px"
                h="100%"
                w="100%"
                overflow="auto"
                sx={{ caretColor: "black", tabSize: 2, whiteSpace: "pre" }}
                _placeholder={{ color: "gray.500" }}
                _focus={{ borderColor: "black", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)", outline: "none" }}
              />
            </Box>
          </Box>
        </Box>

        {/* Right: actions */}
        <VStack justify="start" align="stretch" position="relative" h="100%" w={["95%","95%","95%","600px","600px","600px"]} spacing="16px">
          <Box
            as="button"
            borderRadius="16px"
            bg="black"
            color="white"
            p="16px"
            textAlign="center"
            _hover={{ bg: "gray.800" }}
            _active={{ bg: "gray.900" }}
            transition="background-color 0.2s ease, transform 0.05s ease"
            fontFamily="poppins"
            fontWeight={700}
            onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(1px)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
            onClick={handleGenerate}
            disabled={speaking}
          >
            <HStack gap="10px" justify="center">
              <Text fontSize={["18px","18px","20px"]} lineHeight="1.1" color="white">
                {speaking ? "Speaking…" : "Generate"}
              </Text>
            </HStack>
          </Box>

          <Box
            as="button"
            borderRadius="16px"
            bg="white"
            color="black"
            p="16px"
            textAlign="center"
            borderWidth="1px"
            borderColor="gray.300"
            _hover={{ bg: "gray.50" }}
            transition="background-color 0.2s ease, transform 0.05s ease"
            fontFamily="poppins"
            fontWeight={600}
            onClick={stopAll}
            disabled={!speaking}
          >
            <HStack gap="10px" justify="center">
              <Text fontSize={["16px","16px","18px"]} lineHeight="1.1" color="black">Stop</Text>
            </HStack>
          </Box>
        </VStack>
      </HStack>

      {/* your player UI can remain below */}
      <VStack w="100%" px={["4%","4%","6%","6%","6%","10%"]}>
        <HStack justify="center" align="start" w="100%" flexWrap={["wrap","wrap","nowrap","nowrap","nowrap","nowrap"]}>
          <Box spellCheck={false} wrap="off" resize="none" fontSize="13px" lineHeight="1.6" bg="white" color="black" borderWidth="1px" borderColor="gray.300" borderRadius="12px" p="12px" h="100%" w="1000px" boxShadow="md">
            <HStack align="stretch" spacing={4} w="100%">
              <Box as="button" w="72px" minW="72px" h="110px" borderRadius="10px" borderWidth="1px" borderColor="gray.300" display="flex" alignItems="center" justifyContent="center" bg="gray.50" _hover={{ bg: "gray.200" }}>
                <Text fontSize="24px">▶</Text>
              </Box>
              <VStack align="start" spacing={3} w="100%">
                <Box position="relative" w="100%" h="110px" borderWidth="1px" borderColor="gray.200" borderRadius="8px" bg="gray.50" overflow="hidden" />
                <HStack justify="space-between" align="center" w="100%">
                  <Text fontSize="12px" color="gray.600">00:00 / 00:00</Text>
                  <HStack spacing="2" align="center">
                    <Upload size={20} />
                  </HStack>
                </HStack>
              </VStack>
            </HStack>
          </Box>
        </HStack>
      </VStack>
    </>
  );
}

export default Hero;
