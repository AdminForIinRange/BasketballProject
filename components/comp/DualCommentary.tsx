"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ----------------- Types ----------------- */
type Line = { time?: string; speaker?: string; text: string };

type Seg = {
  id: string;
  idx: number; // sequence index after sort
  role: "Color" | "PlayByPlay";
  speaker: string;
  time?: string;
  startSec?: number;
  text: string;
  ttsUrl: string | null;
  voiceId?: string | null;
};

/* ----------------- Utils ----------------- */
function stableId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}
function parseTranscriptJSON(raw: string): Line[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Root must be an array");
  return parsed.map((row, i) => {
    if (!row || typeof row.text !== "string") {
      throw new Error(`Item ${i} is missing required "text" field`);
    }
    return {
      time: typeof row.time === "string" ? row.time : undefined,
      speaker: typeof row.speaker === "string" ? row.speaker : "Speaker",
      text: row.text,
    };
  });
}
function roleOf(s?: string): "Color" | "PlayByPlay" {
  const name = (s || "").toLowerCase();
  if (name.includes("color")) return "Color";
  if (name.includes("play")) return "PlayByPlay";
  return "PlayByPlay";
}
function parseTimeToSec(tc?: string): number | undefined {
  if (!tc) return undefined;
  const parts = tc.split(":");
  if (parts.length < 2 || parts.length > 3) return undefined;
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) { h = Number(parts[0]) || 0; m = Number(parts[1]) || 0; s = Number(parts[2]) || 0; }
  else { m = Number(parts[0]) || 0; s = Number(parts[1]) || 0; }
  if ([h, m, s].some(n => Number.isNaN(n))) return undefined;
  return h * 3600 + m * 60 + s;
}
const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "00:00";
  const m = Math.floor(n / 60).toString().padStart(2, "0");
  const s = Math.floor(n % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

/* ------------- WaveformCanvas (unchanged deps; now reusable per segment) ------------- */
function WaveformCanvas({
  audioEl,
  src,
  height = 84,
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
  const draggingRef = useRef(false);

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
        let min = 1, max = -1;
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

  useEffect(() => { decodeToPeaks(); }, [decodeToPeaks]);

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
    const tick = () => { repaint(); raf = requestAnimationFrame(tick); };
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

  const timeFromX = (clientX: number) => {
    if (!audioEl || !audioEl.duration || !canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return pct * audioEl.duration;
  };
  const onDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!audioEl) return;
    draggingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    audioEl.currentTime = timeFromX(e.clientX);
  };
  const onMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!draggingRef.current || !audioEl) return;
    audioEl.currentTime = timeFromX(e.clientX);
  };
  const onUp: React.PointerEventHandler<HTMLCanvasElement> = () => {
    draggingRef.current = false;
  };

  return (
    <Box
      w="100%"
      h={`${height}px`}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="12px"
      overflow="hidden"
      bg="white"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "pointer", touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </Box>
  );
}

/* ----------------- Main: pre-rendered sequential splicer ----------------- */
export default function SplicedSequencer() {
  const [raw, setRaw] = useState("");
  const [segments, setSegments] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(false);

  // master player (plays segments one after another)
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const [curIdx, setCurIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [curDur, setCurDur] = useState(0);

  // per-segment audio refs for local preview
  const segAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const orderedSegments = useMemo(() => {
    // order by explicit time if present, else by original appearance (idx)
    const withOrder = [...segments];
    withOrder.sort((a, b) => {
      const aa = (typeof a.startSec === "number" ? a.startSec! : a.idx);
      const bb = (typeof b.startSec === "number" ? b.startSec! : b.idx);
      return aa - bb;
    });
    // reassign idx to reflect sequencing order
    return withOrder.map((s, i) => ({ ...s, idx: i }));
  }, [segments]);

  const bothReady = orderedSegments.length > 0 && orderedSegments.every(s => s.ttsUrl);

  /* ---- Build per-line TTS (pre-rendered “cuts”) ---- */
  const handleBuild = useCallback(async () => {
    try {
      setLoading(true);
      const lines = parseTranscriptJSON(raw);

      // decorate + request TTS per line in parallel
      const tasks = lines.map(async (l, i) => {
        const role = roleOf(l.speaker);
        const startSec = parseTimeToSec(l.time);
        const body = JSON.stringify({
          lines: [{ text: l.text, speaker: l.speaker || "Speaker", time: l.time }]
        });
        try {
          const res = await fetch("/api/playai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return {
              id: stableId("seg"),
              idx: i,
              role,
              speaker: l.speaker || "Speaker",
              time: l.time,
              startSec,
              text: l.text,
              ttsUrl: null,
              voiceId: null,
              _err: err?.error || "TTS failed",
            } as Seg & { _err?: string };
          }
          const data = await res.json();
          const url = (data?.audio?.url as string) ?? null;
          const voiceId =
            (data?.voiceId as string) ??
            (data?.audio?.voiceId as string) ??
            null;

          return {
            id: stableId("seg"),
            idx: i,
            role,
            speaker: l.speaker || "Speaker",
            time: l.time,
            startSec,
            text: l.text,
            ttsUrl: url,
            voiceId,
          } as Seg;
        } catch (e: any) {
          return {
            id: stableId("seg"),
            idx: i,
            role,
            speaker: l.speaker || "Speaker",
            time: l.time,
            startSec,
            text: l.text,
            ttsUrl: null,
            voiceId: null,
          } as Seg;
        }
      });

      const built = await Promise.all(tasks);
      setSegments(built);
      setCurIdx(-1);
      setIsPlaying(false);
    } catch (e: any) {
      alert(e?.message || "Failed to build segments.");
    } finally {
      setLoading(false);
    }
  }, [raw]);

  /* ---- Master playback: walk the sequence without overlap ---- */
  const loadAndPlayIndex = useCallback(async (i: number) => {
    const a = masterAudioRef.current;
    if (!a) return;
    if (i < 0 || i >= orderedSegments.length) {
      setCurIdx(-1);
      setIsPlaying(false);
      return;
    }
    const seg = orderedSegments[i];
    if (!seg.ttsUrl) {
      // skip missing audio
      loadAndPlayIndex(i + 1);
      return;
    }
    a.src = seg.ttsUrl;
    try {
      await a.play();
      setCurIdx(i);
      setIsPlaying(true);
    } catch {
      // user gesture might be required, keep state
      setCurIdx(i);
      setIsPlaying(!(a.paused));
    }
  }, [orderedSegments]);

  const onEnded = useCallback(() => {
    // move to next segment auto
    const next = curIdx + 1;
    if (next < orderedSegments.length) loadAndPlayIndex(next);
    else {
      setIsPlaying(false);
      setCurIdx(-1);
    }
  }, [curIdx, orderedSegments, loadAndPlayIndex]);

  useEffect(() => {
    const a = masterAudioRef.current;
    if (!a) return;
    const onTime = () => { setCurTime(a.currentTime || 0); setCurDur(a.duration || 0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [onEnded]);

  const masterPlay = () => {
    if (curIdx === -1) loadAndPlayIndex(0);
    else loadAndPlayIndex(curIdx);
  };
  const masterPause = () => {
    masterAudioRef.current?.pause();
    setIsPlaying(false);
  };
  const masterStop = () => {
    const a = masterAudioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setCurIdx(-1);
    setIsPlaying(false);
    setCurTime(0);
    setCurDur(0);
  };
  const masterPrev = () => {
    if (curIdx <= 0) { masterStop(); return; }
    loadAndPlayIndex(curIdx - 1);
  };
  const masterNext = () => {
    if (curIdx < 0) { loadAndPlayIndex(0); return; }
    loadAndPlayIndex(curIdx + 1);
  };

  /* ---- Helpers for per-segment preview ---- */
  const attachSegRef = (id: string) => (el: HTMLAudioElement | null) => {
    segAudioRefs.current[id] = el;
  };
  const playSeg = (id: string) => {
    const a = segAudioRefs.current[id];
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
  };

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      <Box w="100%">
        <Text fontSize="20px" fontWeight={700} color="black">
          Pre-rendered Splicer (No Overlap)
        </Text>
      </Box>

      {/* Input / Build */}
      <Box
        w="100%"
        bg="white"
        borderWidth="1px"
        borderColor="gray.300"
        borderRadius="12px"
        p="16px"
        boxShadow="sm"
      >
        <Text fontWeight={600} mb={2}>
          Paste Transcript JSON
        </Text>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          fontSize="13px"
          h="180px"
          placeholder='[{"time":"00:00:03.250","speaker":"PlayByPlay","text":"Tip-off won..."}, ...]'
        />
        <HStack mt={3}>
          <Button onClick={handleBuild} colorScheme="orange" isDisabled={loading}>
            {loading ? "Building…" : "Build Segments"}
          </Button>
          <Text fontSize="sm" color="gray.600" ml="auto">
            {segments.length ? `Segments: ${segments.length}` : ""}
          </Text>
        </HStack>
      </Box>

      {/* Master Transport (plays one-by-one) */}
      <Box
        w="100%"
        bg="white"
        borderWidth="1px"
        borderColor="gray.300"
        borderRadius="12px"
        p="16px"
        boxShadow="md"
      >
        <HStack spacing={3} mb={2}>
          <Button onClick={masterPrev} isDisabled={!bothReady}>Prev</Button>
          <Button onClick={isPlaying ? masterPause : masterPlay} isDisabled={!bothReady}>
            {isPlaying ? "Pause" : (curIdx === -1 ? "Play All" : "Resume")}
          </Button>
          <Button onClick={masterNext} isDisabled={!bothReady}>Next</Button>
          <Button variant="outline" onClick={masterStop} isDisabled={!bothReady}>Stop</Button>
          <Text fontSize="14px" color="gray.600" ml="auto">
            {curIdx >= 0 ? `Seg ${curIdx + 1}/${orderedSegments.length}` : `Idle`} • {fmt(curTime)} / {fmt(curDur)}
          </Text>
        </HStack>
        <audio ref={masterAudioRef} preload="auto" />
      </Box>

      {/* Segments List (each in its own place) */}
      {orderedSegments.length > 0 && (
        <Box
          w="100%"
          bg="white"
          borderWidth="1px"
          borderColor="gray.300"
          borderRadius="12px"
          p="16px"
          boxShadow="sm"
        >
          <Text fontWeight={700} mb={3}>Segments (read-only)</Text>
          <VStack align="stretch" spacing={4}>
            {orderedSegments.map((s) => (
              <Box key={s.id} borderWidth="1px" borderColor="gray.200" borderRadius="10px" p="12px">
                <HStack>
                  <Text fontWeight={700}>#{s.idx + 1}</Text>
                  <Text><b>Role:</b> {s.role}</Text>
                  <Text><b>Speaker:</b> {s.speaker}</Text>
                  <Text><b>Time:</b> {s.time ?? (typeof s.startSec === "number" ? fmt(s.startSec) : "—")}</Text>
                  <Text><b>Voice:</b> {s.voiceId ?? "unknown"}</Text>
                </HStack>
                <Text mt={2}>{s.text}</Text>

                <HStack mt={3} spacing={3}>
                  <Button onClick={() => playSeg(s.id)} isDisabled={!s.ttsUrl}>
                    Play Segment
                  </Button>
                  <Button
                    onClick={() => { const i = orderedSegments.findIndex(x => x.id === s.id); if (i >= 0) { setCurIdx(i); setTimeout(() => masterPlay(), 0); } }}
                    variant="outline"
                    isDisabled={!s.ttsUrl}
                  >
                    Play from Here
                  </Button>
                  <Button as="a" href={s.ttsUrl ?? undefined} download isDisabled={!s.ttsUrl}>
                    Download
                  </Button>
                </HStack>

                <Box mt={3}>
                  <WaveformCanvas
                    audioEl={segAudioRefs.current[s.id] ?? null}
                    src={s.ttsUrl}
                    height={70}
                    baseColor={s.role === "Color" ? "#D6BCFA" : "#90CDF4"}
                    progressColor={s.role === "Color" ? "#805AD5" : "#3182CE"}
                  />
                  <audio ref={attachSegRef(s.id)} preload="auto" src={s.ttsUrl ?? undefined} />
                </Box>
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
