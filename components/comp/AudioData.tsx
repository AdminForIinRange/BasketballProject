"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import TranscriptJsonPanel from "./TranscriptJsonPanel";
import TranscriptTimeline from "./TranscriptTimeline";

/* =========================================================
 * WaveformCanvas (no libs): decodes audio -> draws real peaks
 * - Progress overlay in accent color
 * - Click & drag to seek
 * - Resizes to container
 * =======================================================*/
function WaveformCanvas({
  audioEl,
  src,
  height = 112,
  baseColor = "#CBD5E0",     // gray.300
  progressColor = "#ED8936", // orange.400
  bg = "#FFFFFF",
  onReady,
}: {
  audioEl: HTMLAudioElement | null;
  src: string | null;
  height?: number;
  baseColor?: string;
  progressColor?: string;
  bg?: string;
  onReady?: () => void;
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
      const ACtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new ACtor();
      const decoded: AudioBuffer = await new Promise((resolve, reject) => {
        // Safari requires callback form sometimes
        ctx.decodeAudioData(buf.slice(0), resolve, reject);
      });

      const channel = decoded.getChannelData(0); // mono is fine
      const width = canvasRef.current.clientWidth || 600;
      const samplesPerBucket = Math.max(1, Math.floor(channel.length / width));
      const peaks = new Array(Math.floor(channel.length / samplesPerBucket));

      for (let i = 0, p = 0; i < channel.length; i += samplesPerBucket, p++) {
        let min = 1.0, max = -1.0;
        for (let j = 0; j < samplesPerBucket && i + j < channel.length; j++) {
          const v = channel[i + j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        peaks[p] = Math.max(Math.abs(min), Math.abs(max)); // 0..1
      }

      peaksRef.current = peaks;
      onReady?.();
      ctx.close();
    } catch (e) {
      console.warn("Waveform decode failed:", e);
      peaksRef.current = []; // draw baseline instead of crashing
      onReady?.();
    }
  }, [src, onReady]);

  useEffect(() => { decodeToPeaks(); }, [decodeToPeaks]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const heightPx = height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(heightPx * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, heightPx);

    const mid = Math.floor(heightPx / 2);
    const peaks = peaksRef.current;

    // base waveform
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1;
    if (peaks && peaks.length) {
      const step = Math.max(1, Math.floor(peaks.length / width));
      for (let x = 0, i = 0; x < width; x++, i += step) {
        const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
        const h = Math.max(2, Math.round(amp * (heightPx * 0.9) / 2));
        ctx.beginPath();
        ctx.moveTo(x + 0.5, mid - h);
        ctx.lineTo(x + 0.5, mid + h);
        ctx.stroke();
      }
    } else {
      // baseline while loading
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(width, mid + 0.5);
      ctx.stroke();
    }

    // progress overlay
    if (audioEl && audioEl.duration > 0) {
      const progressX = Math.round((audioEl.currentTime / audioEl.duration) * width);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressX, heightPx);
      ctx.clip();

      ctx.strokeStyle = progressColor;
      if (peaks && peaks.length) {
        const step = Math.max(1, Math.floor(peaks.length / width));
        for (let x = 0, i = 0; x < progressX; x++, i += step) {
          const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
          const h = Math.max(2, Math.round(amp * (heightPx * 0.9) / 2));
          ctx.beginPath();
          ctx.moveTo(x + 0.5, mid - h);
          ctx.lineTo(x + 0.5, mid + h);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(0, mid + 0.5);
        ctx.lineTo(progressX, mid + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      // playhead
      ctx.strokeStyle = progressColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX + 0.5, 0);
      ctx.lineTo(progressX + 0.5, heightPx);
      ctx.stroke();
    }
  }, [audioEl, height, baseColor, progressColor, bg]);

  // animation repaint
  useEffect(() => {
    let raf = 0;
    const tick = () => { repaint(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [repaint]);

  // resize repaint
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => repaint());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [repaint]);

  // seek by pointer
  const timeFromClientX = (clientX: number) => {
    if (!audioEl || !canvasRef.current || !audioEl.duration) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return pct * audioEl.duration;
  };

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!audioEl) return;
    draggingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    audioEl.currentTime = timeFromClientX(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!draggingRef.current || !audioEl) return;
    audioEl.currentTime = timeFromClientX(e.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = () => {
    draggingRef.current = false;
  };

  return (
    <Box
      w="100%"
      h={`${height}px`}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="14px"
      overflow="hidden"
      bg="white"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "pointer" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </Box>
  );
}

/* ================= helpers ================= */
const format = (s: number) => {
  if (!Number.isFinite(s)) return "00:00";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

/* ================= main ================= */
type TranscriptItem = { time?: string; speaker?: string; text: string };

export default function AudioData() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // sequential-load guards to stop "play() interrupted by new load request"
  const loadSeq = useRef(0);
  const lastUrlRef = useRef<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });

  /* ---- receive URL from bus ---- */
  useEffect(() => {
    const onAudioUrl = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url: string };
      if (!detail?.url) return;
      if (detail.url === lastUrlRef.current) return; // ignore duplicates
      lastUrlRef.current = detail.url;
      setAudioUrl(detail.url);
    };
    window.addEventListener("audio:url", onAudioUrl as EventListener);
    return () => window.removeEventListener("audio:url", onAudioUrl as EventListener);
  }, []);

  /* ---- sequenced load + canplay gate ---- */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;

    const mySeq = ++loadSeq.current;  // claim this load turn
    a.pause();
    setIsPlaying(false);

    a.crossOrigin = "anonymous";
    const url = audioUrl;

    const onCanPlay = async () => {
      if (loadSeq.current !== mySeq) return; // stale load, bail
      try {
        await a.play();
        if (loadSeq.current !== mySeq) return; // stale after await
        setIsPlaying(true);
      } catch {
        setIsPlaying(!a.paused);
      }
    };

    a.addEventListener("canplay", onCanPlay, { once: true });
    a.src = url;
    a.load();

    return () => {
      a.removeEventListener("canplay", onCanPlay);
    };
  }, [audioUrl]);

  /* ---- time & end ---- */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime({ cur: a.currentTime || 0, dur: a.duration || 0 });
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

  /* ---- controls ---- */
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
      // If a new load interrupts play(), ignore the error and sync UI to element state
      setIsPlaying(!a.paused);
    }
  };

  const seek = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, (a.currentTime || 0) + delta));
  };

  /* ---- example transcript block (optional) ---- */

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      <Box w="100%">
        <Text fontFamily="poppins" fontWeight="600" color="black" fontSize="20px">
          Audio Player
        </Text>
      </Box>

      {/* Player Card */}
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
        {/* Controls */}
        <HStack spacing={3} mb={3}>
          <Button onClick={() => seek(-5)} isDisabled={!audioUrl}>-5s</Button>
          <Button onClick={togglePlay} isDisabled={!audioUrl}>
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button onClick={() => seek(5)} isDisabled={!audioUrl}>+5s</Button>

          <Text fontSize="14px" color="gray.600" ml="auto">
            {format(time.cur)} / {format(time.dur)}
          </Text>

          <Button as="a" href={audioUrl ?? undefined} download isDisabled={!audioUrl}>
            Download
          </Button>
        </HStack>

        {/* True waveform with progress & seek */}
        <WaveformCanvas
          audioEl={audioRef.current}
          src={audioUrl}
          height={112}
          baseColor="#CBD5E0"
          progressColor="#ED8936"
          bg="#FFFFFF"
        />

        {/* Hidden audio element */}
        <audio ref={audioRef} preload="auto" />
      </Box>

      {/* Optional Transcript Box */}

      
    </VStack>
  );
}
