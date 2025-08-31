"use client";
import { Box, VStack, Text, HStack, Button } from "@chakra-ui/react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import TranscriptTimeline from "./TranscriptTimeline";

type Line = { time?: string; speaker?: string; text: string };

type Props = {
  colorLines?: Line[] | null;
  playLines?: Line[] | null;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "00:00";
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
};

/* ========= Waveform (same look as your AudioData) ========= */
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

    // bg
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const mid = Math.floor(h / 2);
    const peaks = peaksRef.current;

    // base
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

    // progress overlay
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

      // playhead
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

  // seek
  const timeFromX = (clientX: number) => {
    if (!audioEl || !canvasRef.current || !audioEl.duration) return 0;
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
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "pointer",
          touchAction: "none",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </Box>
  );
}

/* ========= Main: dual players + synced timelines ========= */
export default function AudioOverlap({
  colorLines = [],
  playLines = [],
}: Props) {
  const colorRef = useRef<HTMLAudioElement | null>(null);
  const playRef = useRef<HTMLAudioElement | null>(null);

  const [colorUrl, setColorUrl] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const colorSeq = useRef(0);
  const playSeq = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [tColor, setTColor] = useState({ cur: 0, dur: 0 });
  const [tPlay, setTPlay] = useState({ cur: 0, dur: 0 });

  // receive both urls from bus
  useEffect(() => {
    const onDual = (e: Event) => {
      const { playUrl, colorUrl } = (e as CustomEvent).detail || {};
      if (typeof playUrl === "string") setPlayUrl(playUrl);
      if (typeof colorUrl === "string") setColorUrl(colorUrl);
    };
    window.addEventListener("audio:dual", onDual as EventListener);
    return () =>
      window.removeEventListener("audio:dual", onDual as EventListener);
  }, []);

  // safe loader: color
  useEffect(() => {
    const a = colorRef.current;
    if (!a || !colorUrl) return;
    const my = ++colorSeq.current;
    a.pause();
    a.crossOrigin = "anonymous";
    const onCanPlay = () => {
      if (colorSeq.current !== my) return;
    };
    a.addEventListener("canplay", onCanPlay, { once: true });
    a.src = colorUrl;
    a.load();
    return () => a.removeEventListener("canplay", onCanPlay);
  }, [colorUrl]);

  // safe loader: play
  useEffect(() => {
    const a = playRef.current;
    if (!a || !playUrl) return;
    const my = ++playSeq.current;
    a.pause();
    a.crossOrigin = "anonymous";
    const onCanPlay = () => {
      if (playSeq.current !== my) return;
    };
    a.addEventListener("canplay", onCanPlay, { once: true });
    a.src = playUrl;
    a.load();
    return () => a.removeEventListener("canplay", onCanPlay);
  }, [playUrl]);

  // time
  useEffect(() => {
    const ca = colorRef.current,
      pa = playRef.current;
    if (!ca || !pa) return;
    const onC = () =>
      setTColor({ cur: ca.currentTime || 0, dur: ca.duration || 0 });
    const onP = () =>
      setTPlay({ cur: pa.currentTime || 0, dur: pa.duration || 0 });
    const onEnd = () => setIsPlaying(false);
    ca.addEventListener("timeupdate", onC);
    ca.addEventListener("loadedmetadata", onC);
    ca.addEventListener("ended", onEnd);
    pa.addEventListener("timeupdate", onP);
    pa.addEventListener("loadedmetadata", onP);
    pa.addEventListener("ended", onEnd);
    return () => {
      ca.removeEventListener("timeupdate", onC);
      ca.removeEventListener("loadedmetadata", onC);
      ca.removeEventListener("ended", onEnd);
      pa.removeEventListener("timeupdate", onP);
      pa.removeEventListener("loadedmetadata", onP);
      pa.removeEventListener("ended", onEnd);
    };
  }, [colorUrl, playUrl]);

  // controls
  const masterPlay = async () => {
    const ca = colorRef.current,
      pa = playRef.current;
    if (!ca || !pa) return;
    await Promise.allSettled([ca.play(), pa.play()]);
    setIsPlaying(true);
  };
  const masterPause = () => {
    colorRef.current?.pause();
    playRef.current?.pause();
    setIsPlaying(false);
  };
  const masterToggle = () => {
    isPlaying ? masterPause() : masterPlay();
  };
  const masterSeek = (delta: number) => {
    const bump = (a: HTMLAudioElement | null) => {
      if (!a) return;
      a.currentTime = Math.max(
        0,
        Math.min(a.duration || 0, (a.currentTime || 0) + delta),
      );
    };
    bump(colorRef.current);
    bump(playRef.current);
  };
  const masterRestart = () => {
    if (colorRef.current) colorRef.current.currentTime = 0;
    if (playRef.current) playRef.current.currentTime = 0;
  };

  const bothReady = Boolean(colorUrl || playUrl);

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      <Box w="100%">
        <Text
          fontFamily="poppins"
          fontWeight={600}
          color="black"
          fontSize="20px"
        >
          Dual Commentary — Overlap
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
        <HStack spacing={3} mb={3}>
          <Button onClick={() => masterSeek(-5)} isDisabled={!bothReady}>
            -5s
          </Button>
          <Button onClick={masterToggle} isDisabled={!bothReady}>
            {isPlaying ? "Pause Both" : "Play Both"}
          </Button>
          <Button onClick={() => masterSeek(5)} isDisabled={!bothReady}>
            +5s
          </Button>
          <Button
            variant="outline"
            onClick={masterRestart}
            isDisabled={!bothReady}
          >
            Restart
          </Button>
          <Text fontSize="14px" color="gray.600" ml="auto">
            COLOR {fmt(tColor.cur)} / {fmt(tColor.dur)} &nbsp; | &nbsp; PLAY{" "}
            {fmt(tPlay.cur)} / {fmt(tPlay.dur)}
          </Text>
        </HStack>

        {/* Color track */}
        <Box mb={4}>
          <HStack mb={2} spacing={3}>
            <Text fontWeight={700}>Color</Text>
            <Button
              as="a"
              href={colorUrl ?? undefined}
              download
              isDisabled={!colorUrl}
            >
              Download
            </Button>
          </HStack>
          <WaveformCanvas
            audioEl={colorRef.current}
            src={colorUrl}
            height={84}
            baseColor="#D6BCFA"
            progressColor="#805AD5"
          />
          <audio ref={colorRef} preload="auto" />

          {/* Synced transcript timeline */}
          {colorLines && colorLines.length > 0 && (
            <Box mt={3}>
              <TranscriptTimeline
                title="Color Timeline"
                lines={colorLines as any}
                h={260}
                currentTime={tColor.cur}
                onSeek={(t) => {
                  if (colorRef.current) colorRef.current.currentTime = t;
                  if (playRef.current) playRef.current.currentTime = t; // keep aligned
                }}
              />
            </Box>
          )}
        </Box>

        {/* Play-by-Play track */}
        <Box>
          <HStack mb={2} spacing={3}>
            <Text fontWeight={700}>PlayByPlay</Text>
            <Button
              as="a"
              href={playUrl ?? undefined}
              download
              isDisabled={!playUrl}
            >
              Download
            </Button>
          </HStack>
          <WaveformCanvas
            audioEl={playRef.current}
            src={playUrl}
            height={84}
            baseColor="#90CDF4"
            progressColor="#3182CE"
          />
          <audio ref={playRef} preload="auto" />

          {/* Synced transcript timeline */}
          {playLines && playLines.length > 0 && (
            <Box mt={3}>
              <TranscriptTimeline
                title="PlayByPlay Timeline"
                lines={playLines as any}
                h={260}
                currentTime={tPlay.cur}
                onSeek={(t) => {
                  if (colorRef.current) colorRef.current.currentTime = t;
                  if (playRef.current) playRef.current.currentTime = t;
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </VStack>
  );
}
