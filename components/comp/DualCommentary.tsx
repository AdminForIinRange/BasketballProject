"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

/* ----------------- Types ----------------- */
type Line = { time?: string; speaker?: string; text: string };

/* ----------------- Utils ----------------- */
function parseTranscriptJSON(raw: string): Line[] {
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid JSON"); }
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

function splitBySpeaker(lines: Line[]) {
  const color: Line[] = [];
  const play: Line[]  = [];
  for (const l of lines) {
    const name = (l.speaker || "").toLowerCase();
    if (name.includes("color")) color.push(l);
    else if (name.includes("play")) play.push(l);
    else {
      // default route non-matching to PlayByPlay (adjust if you prefer)
      play.push(l);
    }
  }
  return { color, play };
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "00:00";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

/* ------------- WaveformCanvas (optional pretty waves; no extra deps) ------------- */
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
      const ACtor = (window as any).AudioContext || (window as any).webkitAudioContext;
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
    c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const mid = Math.floor(h / 2);
    const peaks = peaksRef.current;

    // base
    ctx.strokeStyle = baseColor; ctx.lineWidth = 1;
    if (peaks && peaks.length) {
      const step = Math.max(1, Math.floor(peaks.length / w));
      for (let x = 0, i = 0; x < w; x++, i += step) {
        const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
        const ph = Math.max(2, Math.round(amp * (h * 0.9) / 2));
        ctx.beginPath();
        ctx.moveTo(x + 0.5, mid - ph);
        ctx.lineTo(x + 0.5, mid + ph);
        ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(w, mid + 0.5); ctx.stroke();
    }

    // progress overlay
    if (audioEl && audioEl.duration > 0) {
      const px = Math.round((audioEl.currentTime / audioEl.duration) * w);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, px, h); ctx.clip();
      ctx.strokeStyle = progressColor;
      if (peaks && peaks.length) {
        const step = Math.max(1, Math.floor(peaks.length / w));
        for (let x = 0, i = 0; x < px; x++, i += step) {
          const amp = peaks[Math.min(i, peaks.length - 1)] ?? 0;
          const ph = Math.max(2, Math.round(amp * (h * 0.9) / 2));
          ctx.beginPath();
          ctx.moveTo(x + 0.5, mid - ph);
          ctx.lineTo(x + 0.5, mid + ph);
          ctx.stroke();
        }
      } else {
        ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(px, mid + 0.5); ctx.stroke();
      }
      ctx.restore();

      // playhead
      ctx.strokeStyle = progressColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, h); ctx.stroke();
    }
  }, [audioEl, height, baseColor, progressColor, bg]);

  useEffect(() => {
    let raf = 0; const tick = () => { repaint(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [repaint]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ro = new ResizeObserver(() => repaint()); ro.observe(c);
    return () => ro.disconnect();
  }, [repaint]);

  const timeFromX = (clientX: number) => {
    if (!audioEl || !audioEl.duration || !canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return pct * audioEl.duration;
  };
  const onDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!audioEl) return; draggingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    audioEl.currentTime = timeFromX(e.clientX);
  };
  const onMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!draggingRef.current || !audioEl) return;
    audioEl.currentTime = timeFromX(e.clientX);
  };
  const onUp: React.PointerEventHandler<HTMLCanvasElement> = () => { draggingRef.current = false; };

  return (
    <Box w="100%" h={`${height}px`} borderWidth="1px" borderColor="gray.200" borderRadius="12px" overflow="hidden" bg="white">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "pointer", touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      />
    </Box>
  );
}

/* ----------------- Main ----------------- */
export default function DualCommentary() {
  // text input
  const [raw, setRaw] = useState("");

  // split lines
  const [colorLines, setColorLines] = useState<Line[] | null>(null);
  const [playLines,  setPlayLines]  = useState<Line[] | null>(null);

  // audio elements + urls
  const colorAudioRef = useRef<HTMLAudioElement | null>(null);
  const playAudioRef  = useRef<HTMLAudioElement | null>(null);
  const [colorUrl, setColorUrl] = useState<string | null>(null);
  const [playUrl,  setPlayUrl]  = useState<string | null>(null);

  // sequenced loaders for both tracks
  const colorSeq = useRef(0); const playSeq = useRef(0);

  // basic state
  const [isPlaying, setIsPlaying] = useState(false);
  const [tColor, setTColor] = useState({ cur: 0, dur: 0 });
  const [tPlay,  setTPlay]  = useState({ cur: 0, dur: 0 });

  /* ---- generate two tracks from JSON ---- */
  const handleGenerate = async () => {
    try {
      const lines = parseTranscriptJSON(raw);
      const { color, play } = splitBySpeaker(lines);
      if (!color.length && !play.length) throw new Error("No lines after split.");

      setColorLines(color);
      setPlayLines(play);

      // kick off two requests in parallel
      const bodyFor = (arr: Line[]) => JSON.stringify({ lines: arr });
      const [resColor, resPlay] = await Promise.all([
        color.length ? fetch("/api/playai", { method: "POST", headers: { "Content-Type": "application/json" }, body: bodyFor(color) }) : Promise.resolve(null),
        play.length  ? fetch("/api/playai",  { method: "POST", headers: { "Content-Type": "application/json" }, body: bodyFor(play)  }) : Promise.resolve(null),
      ]);

      const getUrl = async (res: Response | null) => {
        if (!res) return null;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "TTS request failed");
        }
        const data = await res.json();
        return (data?.audio?.url as string) ?? null;
      };

      const [uColor, uPlay] = await Promise.all([getUrl(resColor), getUrl(resPlay)]);
      setColorUrl(uColor);
      setPlayUrl(uPlay);
    } catch (e: any) {
      alert(e?.message || "Failed to generate audio.");
    }
  };

  /* ---- safe loader: COLOR ---- */
  useEffect(() => {
    const a = colorAudioRef.current;
    if (!a || !colorUrl) return;
    const my = ++colorSeq.current;
    a.pause();

    a.crossOrigin = "anonymous";
    const onReady = async () => {
      if (colorSeq.current !== my) return;
      // don't auto-play here; we'll start both together from master play
    };
    a.addEventListener("canplay", onReady, { once: true });
    a.src = colorUrl;
    a.load();
    return () => a.removeEventListener("canplay", onReady);
  }, [colorUrl]);

  /* ---- safe loader: PLAYBYPLAY ---- */
  useEffect(() => {
    const a = playAudioRef.current;
    if (!a || !playUrl) return;
    const my = ++playSeq.current;
    a.pause();

    a.crossOrigin = "anonymous";
    const onReady = async () => {
      if (playSeq.current !== my) return;
      // don't auto-play; master controls will do it
    };
    a.addEventListener("canplay", onReady, { once: true });
    a.src = playUrl;
    a.load();
    return () => a.removeEventListener("canplay", onReady);
  }, [playUrl]);

  /* ---- clock updates ---- */
  useEffect(() => {
    const ca = colorAudioRef.current, pa = playAudioRef.current;
    if (!ca || !pa) return;
    const onC = () => setTColor({ cur: ca.currentTime || 0, dur: ca.duration || 0 });
    const onP = () => setTPlay({  cur: pa.currentTime || 0, dur: pa.duration || 0 });
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

  /* ---- master controls (sync both) ---- */
  const masterPlay = async () => {
    const ca = colorAudioRef.current, pa = playAudioRef.current;
    if (!ca || !pa) return;
    try {
      // start both as close together as possible
      await Promise.allSettled([ca.play(), pa.play()]);
      setIsPlaying(true);
    } catch {
      setIsPlaying(!((ca?.paused ?? true) || (pa?.paused ?? true)));
    }
  };
  const masterPause = () => {
    colorAudioRef.current?.pause();
    playAudioRef.current?.pause();
    setIsPlaying(false);
  };
  const masterToggle = () => {
    if (isPlaying) masterPause(); else masterPlay();
  };
  const masterSeek = (delta: number) => {
    const bump = (a: HTMLAudioElement | null) => {
      if (!a) return;
      a.currentTime = Math.max(0, Math.min(a.duration || 0, (a.currentTime || 0) + delta));
    };
    bump(colorAudioRef.current);
    bump(playAudioRef.current);
  };
  const masterSetTime = (t: number) => {
    if (colorAudioRef.current) colorAudioRef.current.currentTime = Math.min(t, colorAudioRef.current.duration || t);
    if (playAudioRef.current)  playAudioRef.current.currentTime  = Math.min(t, playAudioRef.current.duration  || t);
  };

  const bothReady = Boolean((colorUrl && playUrl) || colorUrl || playUrl);

  return (
    <VStack w="100%" spacing={6} px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
      <Box w="100%">
        <Text fontSize="20px" fontWeight={700} color="black">Dual Commentary (Overlap)</Text>
      </Box>

      {/* Input / Generate */}
      <Box w="100%" bg="white" borderWidth="1px" borderColor="gray.300" borderRadius="12px" p="16px" boxShadow="sm">
        <Text fontWeight={600} mb={2}>Paste Transcript JSON</Text>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          fontSize="13px"
          h="180px"
          placeholder='[ { "time":"00:00:03.250", "speaker":"PlayByPlay", "text":"Tip-off won..." }, ... ]'
        />
        <HStack mt={3}>
          <Button onClick={handleGenerate} colorScheme="orange">Generate 2 Tracks</Button>
          <Text fontSize="sm" color="gray.600">
            {colorLines ? `Color: ${colorLines.length} lines` : ""} {playLines ? `• Play: ${playLines.length} lines` : ""}
          </Text>
        </HStack>
      </Box>

      {/* Master Controls */}
      <Box w="100%" bg="white" borderWidth="1px" borderColor="gray.300" borderRadius="12px" p="16px" boxShadow="md">
        <HStack spacing={3} mb={4}>
          <Button onClick={() => masterSeek(-5)} isDisabled={!bothReady}>-5s</Button>
          <Button onClick={masterToggle} isDisabled={!bothReady}>{isPlaying ? "Pause Both" : "Play Both"}</Button>
          <Button onClick={() => masterSeek(5)} isDisabled={!bothReady}>+5s</Button>
          <Text fontSize="14px" color="gray.600" ml="auto">
            COLOR {fmt(tColor.cur)} / {fmt(tColor.dur)} &nbsp; | &nbsp; PLAY {fmt(tPlay.cur)} / {fmt(tPlay.dur)}
          </Text>
        </HStack>

        {/* Color track */}
        <Box mb={4}>
          <HStack mb={2} spacing={3}>
            <Text fontWeight={700}>Color</Text>
            <Button as="a" href={colorUrl ?? undefined} download isDisabled={!colorUrl}>Download</Button>
            <Button onClick={() => masterSetTime(0)} variant="outline" isDisabled={!bothReady}>Restart Both</Button>
          </HStack>
          <WaveformCanvas audioEl={colorAudioRef.current} src={colorUrl} height={84} baseColor="#D6BCFA" progressColor="#805AD5" />
          <audio ref={colorAudioRef} preload="auto" />
        </Box>

        {/* PlayByPlay", track */}
        <Box>
          <HStack mb={2} spacing={3}>
            <Text fontWeight={700}>PlayByPlay</Text>
            <Button as="a" href={playUrl ?? undefined} download isDisabled={!playUrl}>Download</Button>
          </HStack>
          <WaveformCanvas audioEl={playAudioRef.current} src={playUrl} height={84} baseColor="#90CDF4" progressColor="#3182CE" />
          <audio ref={playAudioRef} preload="auto" />
        </Box>
      </Box>
    </VStack>
  );
}

