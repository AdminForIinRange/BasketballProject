"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import { PauseIcon, PlayIcon, SkipBack, SkipForward } from "lucide-react";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import TranscriptTimeline, { TLLine } from "./TranscriptTimeline";

/* ===== waveform (same minimal one as overlap; omit if you reuse) ===== */
function WaveformCanvas({
  audioEl,
  src,
  height = 112,
  baseColor = "#CBD5E0",
  progressColor = "#ED8936",
  bg = "#FFFFFF",
}: {
  audioEl: HTMLAudioElement | null;
  src: string | null;
  height?: number;
  baseColor?: string;
  progressColor?: string;
  bg?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);

  const decodeToPeaks = useCallback(async () => {
    peaksRef.current = null;
    if (!src || !canvasRef.current) return;
    try {
      const res = await fetch(src, { mode: "cors" });
      const buf = await res.arrayBuffer();
      const ACtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new ACtor();
      const decoded: AudioBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(buf.slice(0), resolve, reject);
      });
      const ch = decoded.getChannelData(0);
      const width = canvasRef.current.clientWidth || 600;
      const per = Math.max(1, Math.floor(ch.length / width));
      const peaks = new Array(Math.floor(ch.length / per));
      for (let i = 0, p = 0; i < ch.length; i += per, p++) {
        let min = 1,
          max = -1;
        for (let j = 0; j < per && i + j < ch.length; j++) {
          const v = ch[i + j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        peaks[p] = Math.max(Math.abs(min), Math.abs(max));
      }
      peaksRef.current = peaks;
      ctx.close();
    } catch {
      peaksRef.current = [];
    }
  }, [src]);

  useEffect(() => {
    decodeToPeaks();
  }, [decodeToPeaks]);

  const repaint = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = height;

    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const mid = Math.floor(h / 2);
    const peaks = peaksRef.current;

    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1;
    if (peaks && peaks.length) {
      const step = Math.max(1, Math.floor(peaks.length / w));
      for (let x = 0, i = 0; x < w; x++, i += step) {
        const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
        const ph = Math.max(2, Math.round((amp * (h * 0.9)) / 2));
        ctx.beginPath();
        ctx.moveTo(x + 0.5, mid - ph);
        ctx.lineTo(x + 0.5, mid + ph);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(w, mid + 0.5);
      ctx.stroke();
    }

    if (audioEl && audioEl.duration > 0) {
      const px = Math.round((audioEl.currentTime / audioEl.duration) * w);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, px, h);
      ctx.clip();

      ctx.strokeStyle = progressColor;
      if (peaks && peaks.length) {
        const step = Math.max(1, Math.floor(peaks.length / w));
        for (let x = 0, i = 0; x < px; x++, i += step) {
          const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
          const ph = Math.max(2, Math.round((amp * (h * 0.9)) / 2));
          ctx.beginPath();
          ctx.moveTo(x + 0.5, mid - ph);
          ctx.lineTo(x + 0.5, mid + ph);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(0, mid + 0.5);
        ctx.lineTo(px, mid + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = progressColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, 0);
      ctx.lineTo(px + 0.5, h);
      ctx.stroke();
    }
  }, [audioEl, height, baseColor, progressColor, bg]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      repaint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [repaint]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => repaint());
    ro.observe(c);
    return () => ro.disconnect();
  }, [repaint]);

  return (
    <Box
      w="100%"
      h={`${height}px`}
      borderWidth="1px"
      borderColor="gray.300"
      borderRadius="16px"
      overflow="hidden"
      bg="white"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </Box>
  );
}

/* ===== helpers ===== */
const format = (s: number) => {
  if (!Number.isFinite(s)) return "00:00";
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
};
const secToStamp = (s: number) => {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${ms ? "." + String(ms).padStart(3, "0") : ""}`;
};

type TranscriptItem = { time?: string; speaker?: string; text: string };
const parseTranscriptJSON = (raw: string): TranscriptItem[] => {
  let parsed: any;
  parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Root must be an array");
  return parsed.map((row, i) => {
    if (!row || typeof row.text !== "string")
      throw new Error(`Item ${i} is missing required "text"`);
    return {
      time: typeof row.time === "string" ? row.time : undefined,
      speaker: typeof row.speaker === "string" ? row.speaker : "Speaker",
      text: row.text,
    };
  });
};

/* ===== main ===== */
export default function ScriptAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadSeq = useRef(0);
  const lastUrlRef = useRef<string | null>(null);

  const [transcript, setTranscript] = useState<string>(`[
  {
    "time": "00:00:03.250",
    "speaker": "PlayByPlay",
    "text": "And we’re off! Tip-off won by the Tigers!"
  },
  {
    "time": "00:00:08.000", 
    "speaker": "Color", 
    "text": "Oh, look at that jump! Okafor’s vertical is off the charts!"
  },
  {
    "time": "00:00:13.500", 
    "speaker": "PlayByPlay", 
    "text": "Johnson bringing it over the half-court line now, eyeing his options."
  },
  {
    "time": "00:00:17.500", 
    "speaker": "Color", 
    "text": "He’s got that smooth handle—no pressure, just gliding across the floor!"
  },
  {
    "time": "00:00:22.000", 
    "speaker": "PlayByPlay", 
    "text": "Looks like he’s setting up for a play here. Moving towards the right side of the court."
  },
  {
    "time": "00:00:26.000", 
    "speaker": "Color", 
    "text": "Smart move, but I bet the defender is thinking, ‘Not so fast, Johnson!’"
  },
  {
    "time": "00:00:30.500", 
    "speaker": "PlayByPlay", 
    "text": "He’s driving! Johnson takes it strong to the basket... could this be a dunk?"
  },
  {
    "time": "00:00:35.000", 
    "speaker": "Color", 
    "text": "Oh, baby! That was *smooth*! And yes, he finished with style! What a move!"
  },
  {
    "time": "00:00:40.000", 
    "speaker": "PlayByPlay", 
    "text": "What a play! Tigers take the lead with that explosive move from Johnson!"
  },
  {
    "time": "00:00:45.000", 
    "speaker": "Color", 
    "text": "You know, I’ve seen him do that a thousand times, and it never gets old!"
  }
]


`);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [busy, setBusy] = useState(false);
  const [fullLines, setFullLines] = useState<TLLine[]>([]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    const mySeq = ++loadSeq.current;
    a.pause();
    setIsPlaying(false);
    a.crossOrigin = "anonymous";
    const onCanPlay = async () => {
      if (loadSeq.current !== mySeq) return;
      try {
        await a.play();
        if (loadSeq.current !== mySeq) return;
        setIsPlaying(true);
      } catch {
        setIsPlaying(!a.paused);
      }
    };
    a.addEventListener("canplay", onCanPlay, { once: true });
    a.src = audioUrl;
    a.load();
    return () => a.removeEventListener("canplay", onCanPlay);
  }, [audioUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () =>
      setTime({ cur: a.currentTime || 0, dur: a.duration || 0 });
    const onEnd = () => setIsPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  // (Est.) timeline: distribute line starts by text length across total duration
  useEffect(() => {
    let rows: TranscriptItem[] = [];
    try {
      rows = JSON.parse(transcript);
    } catch {
      rows = [];
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      setFullLines([]);
      return;
    }
    const totalChars = rows.reduce((n, r) => n + (r.text?.length || 0), 0) || 1;
    let acc = 0;
    const est: TLLine[] = rows.map((r) => {
      const weight = (r.text?.length || 0) / totalChars;
      const start = acc * (time.dur || 0);
      acc += weight;
      return {
        time: secToStamp(start),
        speaker: r.speaker || "Speaker",
        text: r.text || "",
      };
    });
    setFullLines(est);
  }, [transcript, time.dur]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    try {
      if (!transcript.trim()) {
        alert("Paste a JSON transcript first.");
        return;
      }
      const lines = parseTranscriptJSON(transcript);
      setBusy(true);

      const res = await fetch("/api/singeloldplayai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "TTS request failed");
      }
      const data = await res.json();
      const url = data?.audio?.url as string | undefined;
      if (!url) throw new Error("No audio URL returned");

      if (url !== lastUrlRef.current) {
        lastUrlRef.current = url;
        setAudioUrl(url);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Couldn't generate audio:\n${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [busy, transcript]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (a.paused) {
        await a.play();
        setIsPlaying(true);
      } else {
        a.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(!a.paused);
    }
  };
  const seek = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(
      0,
      Math.min(a.duration || 0, (a.currentTime || 0) + delta)
    );
  };

  const loadSample = () => {
    setTranscript(`[
  {
    "time": "00:00:03.250",
    "speaker": "PlayByPlay",
    "text": "And we’re off! Tip-off won by the Tigers!"
  },
  {
    "time": "00:00:08.000", 
    "speaker": "Color", 
    "text": "Oh, look at that jump! Okafor’s vertical is off the charts!"
  },
  {
    "time": "00:00:13.500", 
    "speaker": "PlayByPlay", 
    "text": "Johnson bringing it over the half-court line now, eyeing his options."
  },
  {
    "time": "00:00:17.500", 
    "speaker": "Color", 
    "text": "He’s got that smooth handle—no pressure, just gliding across the floor!"
  },
  {
    "time": "00:00:22.000", 
    "speaker": "PlayByPlay", 
    "text": "Looks like he’s setting up for a play here. Moving towards the right side of the court."
  },
  {
    "time": "00:00:26.000", 
    "speaker": "Color", 
    "text": "Smart move, but I bet the defender is thinking, ‘Not so fast, Johnson!’"
  },
  {
    "time": "00:00:30.500", 
    "speaker": "PlayByPlay", 
    "text": "He’s driving! Johnson takes it strong to the basket... could this be a dunk?"
  },
  {
    "time": "00:00:35.000", 
    "speaker": "Color", 
    "text": "Oh, baby! That was *smooth*! And yes, he finished with style! What a move!"
  },
  {
    "time": "00:00:40.000", 
    "speaker": "PlayByPlay", 
    "text": "What a play! Tigers take the lead with that explosive move from Johnson!"
  },
  {
    "time": "00:00:45.000", 
    "speaker": "Color", 
    "text": "You know, I’ve seen him do that a thousand times, and it never gets old!"
  }
]


`);
  };

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      <Box w="100%">
        <Text
          fontFamily="poppins"
          fontWeight={600}
          color="black"
          fontSize="20px"
          mt="50px"
        >
          Non-Overlapping Audio — Natural Flow
        </Text>
      </Box>

      <Box
        w="100%"
        bg="white"
        borderWidth="1px"
        borderColor="gray.300"
        borderRadius="16px"
        p="16px"
        boxShadow="md"
      >
        <Textarea
          borderRadius="24px"
          aria-label="Paste JSON with timestamps"
          placeholder="[ ... ]"
          spellCheck={false}
          resize="none"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace"
          fontSize="13px"
          lineHeight="1.6"
          color="black"
          p="12px"
          h="200px"
          w="100%"
          _placeholder={{ color: "gray.500" }}
          _focus={{
            borderColor: "black",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
            outline: "none",
          }}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <HStack mt={3} spacing={3}>
          <Button  bg={"orange.400"}
            fontFamily="poppins"
            fontWeight={600} onClick={handleGenerate} isDisabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </Button>
          {/* <Button bg={"orange.400"}
            fontFamily="poppins"
            fontWeight={600} onClick={loadSample}>
            Load sample
          </Button> */}
        </HStack>
      </Box>

      <Box
        w="100%"
        bg="white"
        color="black"
        borderWidth="1px"
        borderColor="gray.300"
        borderRadius="16px"
        p="16px"
        boxShadow="md"
      >
        <HStack spacing={3} mb={3}>
          <Button
            bg="orange.400"
            onClick={() => seek(-5)}
            isDisabled={!audioUrl}
          >
            <SkipBack />
          </Button>
          <Button bg="orange.400" onClick={togglePlay} isDisabled={!audioUrl}>
            {" "}
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            bg="orange.400"
            onClick={() => seek(5)}
            isDisabled={!audioUrl}
          >
            <SkipForward />
          </Button>
          <Text  fontSize="14px" color="gray.600" ml="auto">
            {format(time.cur)} / {format(time.dur)}
          </Text>
          <Button
           bg={"orange.400"}
            fontFamily="poppins"
            fontWeight={600}
            as="a"
            href={audioUrl ?? undefined}
            download
            isDisabled={!audioUrl}
          >
            Download
          </Button>
        </HStack>

        <WaveformCanvas
          audioEl={audioRef.current}
          src={audioUrl}
          height={112}
        />
        <audio ref={audioRef} preload="auto" />

        {fullLines.length > 0 && (
          <Box mt={4}>
            <TranscriptTimeline
              title="Transcript"
              lines={fullLines}
              h={280}
              currentTime={time.cur}
              onSeek={(t) => {
                const a = audioRef.current;
                if (!a) return;
                a.currentTime = Math.max(0, Math.min(t, a.duration || t));
              }}
            />
          </Box>
        )}
      </Box>
    </VStack>
  );
}
