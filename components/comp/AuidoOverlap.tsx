"use client";
import { Box, VStack, Text, HStack, Button } from "@chakra-ui/react";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import TranscriptTimeline from "./TranscriptTimeline";
import {
  SkipBack,
  PauseIcon,
  PlayIcon,
  SkipForward,
  RotateCcw,
} from "lucide-react";

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

// HH:MM:SS(.mmm) or MM:SS(.mmm) -> seconds
const toSec = (t?: string) => {
  if (!t) return 0;
  const parts = t.split(":");
  if (parts.length === 2) {
    const [mm, sRest] = parts;
    const [ss, ms] = sRest.split(".");
    return +mm * 60 + +(ss || 0) + (ms ? Number(`0.${ms}`) : 0);
  }
  if (parts.length === 3) {
    const [hh, mm, sRest] = parts;
    const [ss, ms] = sRest.split(".");
    return +hh * 3600 + +mm * 60 + +(ss || 0) + (ms ? Number(`0.${ms}`) : 0);
  }
  return 0;
};

/* ========= Waveform (no extra libs) ========= */
function WaveformCanvas({
  audioEl,
  src,
  height = 84,
  baseColor = "#CBD5E0",
  progressColor = "#ED8936",
  bg = "#FFFFFF",
  enableSeek = true,
}: {
  audioEl: HTMLAudioElement | null;
  src: string | null;
  height?: number;
  baseColor?: string;
  progressColor?: string;
  bg?: string;
  enableSeek?: boolean;
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

    // base waveform
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

  // click/drag seek
  const timeFromX = (clientX: number) => {
    if (!audioEl || !canvasRef.current || !audioEl.duration) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return pct * audioEl.duration;
  };
  const onDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!enableSeek || !audioEl) return;
    draggingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    audioEl.currentTime = timeFromX(e.clientX);
  };
  const onMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!enableSeek || !draggingRef.current || !audioEl) return;
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
          cursor: enableSeek ? "pointer" : "default",
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

/* ========= NEW: Simple single-track player (non-overlap) ========= */
/* ========= UPDATED: Simple single-track player (non-overlap) ========= */

/* ========= Main: dual players + offsets aligned to transcript ========= */
export default function AudioOverlap({
  colorLines = [],
  playLines = [],
}: Props) {
  const colorRef = useRef<HTMLAudioElement | null>(null);
  const playRef = useRef<HTMLAudioElement | null>(null);

  const [colorUrl, setColorUrl] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  // sequence guards for loads
  const colorSeq = useRef(0);
  const playSeq = useRef(0);

  // delayed start timers
  const colorDelay = useRef<number | null>(null);
  const playDelay = useRef<number | null>(null);

  // UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [tColor, setTColor] = useState({ cur: 0, dur: 0 });
  const [tPlay, setTPlay] = useState({ cur: 0, dur: 0 });

  // ---------- memoized data ----------
  const offsetColor = useMemo(() => {
    if (!colorLines || !colorLines.length) return 0;
    return Math.min(...colorLines.map((l) => toSec(l.time)));
  }, [colorLines]);
  const offsetPlay = useMemo(() => {
    if (!playLines || !playLines.length) return 0;
    return Math.min(...playLines.map((l) => toSec(l.time)));
  }, [playLines]);
  const fullLines: Line[] = useMemo(() => {
    const merged = [...(colorLines || []), ...(playLines || [])];
    return merged.slice().sort((a, b) => toSec(a.time) - toSec(b.time));
  }, [colorLines, playLines]);

  // global transcript time (based on elements + offsets)
  const globalTime = Math.max(
    (tColor.cur || 0) + offsetColor,
    (tPlay.cur || 0) + offsetPlay,
  );
  const fullCurrent = globalTime;

  // ---------- effects ----------
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

  // ---------- helpers ----------
  const clearDelays = () => {
    if (colorDelay.current) {
      clearTimeout(colorDelay.current);
      colorDelay.current = null;
    }
    if (playDelay.current) {
      clearTimeout(playDelay.current);
      playDelay.current = null;
    }
  };

  // map a global transcript time -> each audio element, and play/pause as needed
  const seekGlobal = (T: number, keepPlaying: boolean) => {
    const ca = colorRef.current,
      pa = playRef.current;
    if (!ca || !pa) return;
    clearDelays();

    const tc = Math.max(0, T - offsetColor);
    const tp = Math.max(0, T - offsetPlay);

    ca.currentTime = Math.min(ca.duration || tc, tc);
    pa.currentTime = Math.min(pa.duration || tp, tp);

    if (!keepPlaying) {
      ca.pause();
      pa.pause();
      return;
    }

    const needDelayC = T < offsetColor;
    const needDelayP = T < offsetPlay;

    const plays: Promise<any>[] = [];
    if (!needDelayC) plays.push(ca.play().catch(() => {}));
    else ca.pause();
    if (!needDelayP) plays.push(pa.play().catch(() => {}));
    else pa.pause();

    if (needDelayC) {
      colorDelay.current = window.setTimeout(
        () => {
          ca.currentTime = 0;
          ca.play().catch(() => {});
        },
        Math.round((offsetColor - T) * 1000),
      );
    }
    if (needDelayP) {
      playDelay.current = window.setTimeout(
        () => {
          pa.currentTime = 0;
          pa.play().catch(() => {});
        },
        Math.round((offsetPlay - T) * 1000),
      );
    }
  };

  // ---------- controls ----------
  const [playingFlag, setPlayingFlag] = useState(false);
  useEffect(() => {
    setIsPlaying(playingFlag);
  }, [playingFlag]);

  const masterPlay = () => {
    seekGlobal(globalTime, true);
    setPlayingFlag(true);
  };
  const masterPause = () => {
    clearDelays();
    colorRef.current?.pause();
    playRef.current?.pause();
    setPlayingFlag(false);
  };
  const masterToggle = () => {
    (isPlaying ? masterPause : masterPlay)();
  };
  const masterSeek = (delta: number) => {
    seekGlobal(Math.max(0, globalTime + delta), isPlaying);
  };
  const masterRestart = () => {
    const T0 = Math.min(offsetColor || 0, offsetPlay || 0, 0);
    seekGlobal(T0, isPlaying);
  };

  const bothReady = Boolean(colorUrl || playUrl);

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      {/* Existing dual overlap section */}
      <Box w="100%">
        <Text
          fontFamily="poppins"
          fontWeight={600}
          color="black"
          fontSize="20px"
          mt="10px"
        >
          Dual Commentary — Overlap (Aligned to Transcript)
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
          <Button
            bg={"orange.400"}
            onClick={() => masterSeek(-5)}
            isDisabled={!bothReady}
          >
            <SkipBack />
          </Button>
          <Button
            bg={"orange.400"}
            onClick={masterToggle}
            isDisabled={!bothReady}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            bg={"orange.400"}
            onClick={() => masterSeek(5)}
            isDisabled={!bothReady}
          >
            <SkipForward />
          </Button>
          <Button
            bg={"orange.400"}
            onClick={masterRestart}
            isDisabled={!bothReady}
          >
            <RotateCcw />
          </Button>
          <Text fontSize="14px" color="gray.600" ml="auto">
            COLOR {fmt(tColor.cur)} / {fmt(tColor.dur)} &nbsp; | &nbsp; PLAY{" "}
            {fmt(tPlay.cur)} / {fmt(tPlay.dur)}
          </Text>
        </HStack>

        {/* Color track */}
        <Box mb={4}>
          <HStack mb={2} spacing={3}></HStack>
          <WaveformCanvas
            audioEl={colorRef.current}
            src={colorUrl}
            height={84}
            baseColor="#D6BCFA"
            progressColor="#805AD5"
          />
          <audio ref={colorRef} preload="auto" />
        </Box>

        {/* Play-by-Play track */}
        <Box mb={6}>
          <HStack mb={2} spacing={3}></HStack>
          <WaveformCanvas
            audioEl={playRef.current}
            src={playUrl}
            height={84}
            baseColor="#90CDF4"
            progressColor="#3182CE"
          />
          <audio ref={playRef} preload="auto" />
        </Box>

        {/* FULL combined timeline */}
        {fullLines.length > 0 && (
          <Box>
            <TranscriptTimeline
              title="Full Timeline (All Speakers)"
              lines={fullLines as any}
              h={300}
              currentTime={fullCurrent}
              onSeek={(t) => {
                seekGlobal(t, isPlaying);
              }}
            />
          </Box>
        )}
      </Box>
    </VStack>
  );
}
