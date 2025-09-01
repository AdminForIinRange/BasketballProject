"use client";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Box } from "@chakra-ui/react";

/**
 * Lightweight, dependency-free audio waveform renderer with:
 * - True waveform from decoded PCM (Web Audio API)
 * - Buffered layer (light)
 * - Played progress overlay (accent)
 * - Hover + click/drag seek
 * - Resizes on container width changes
 *
 * Props:
 *   audio: HTMLAudioElement | null   // required
 *   src: string | null               // required to decode waveform
 *   height?: number                  // canvas height (px)
 *   onSeek?: (time: number) => void  // optional external hook
 *   accent?: string                  // Chakra color token for progress
 *   base?: string                    // Chakra token for base waveform
 *   buffer?: string                  // token for buffered overlay
 */
type Props = {
  audio: HTMLAudioElement | null;
  src: string | null;
  height?: number;
  onSeek?: (t: number) => void;
  accent?: string;
  base?: string;
  buffer?: string;
};

export default function WaveformCanvas({
  audio,
  src,
  height = 120,
  onSeek,
  accent = "#ed8936",      // orange.400
  base = "#cbd5e0",        // gray.300
  buffer = "#e2e8f0",      // gray.200
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Decode + generate peaks when src changes
  useEffect(() => {
    let aborted = false;
    async function load() {
      setPeaks(null);
      if (!src) return;

      try {
        // cross-origin safe fetch (FAL URLs are remote)
        const res = await fetch(src, { mode: "cors" });
        const buf = await res.arrayBuffer();

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(buf);

        // Build downsampled peak array for speed (one peak per pixel)
        const channelData = decoded.getChannelData(0); // mono view is fine for UI
        const canvas = canvasRef.current;
        const width = canvas?.clientWidth ?? 600;
        const samplesPerBucket = Math.max(1, Math.floor(channelData.length / width));
        const nextPeaks: number[] = new Array(Math.floor(channelData.length / samplesPerBucket));

        for (let i = 0, p = 0; i < channelData.length; i += samplesPerBucket, p++) {
          let min = 1.0, max = -1.0;
          for (let j = 0; j < samplesPerBucket && i + j < channelData.length; j++) {
            const v = channelData[i + j];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          // store amplitude (abs) normalized 0..1
          nextPeaks[p] = Math.max(Math.abs(min), Math.abs(max));
        }
        if (!aborted) setPeaks(nextPeaks);
        ctx.close();
      } catch (e) {
        console.warn("Waveform decode failed:", e);
        if (!aborted) setPeaks([]); // still render empty baseline
      }
    }
    load();
    return () => { aborted = true; };
  }, [src]);

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
    ctx.scale(dpr, dpr);

    // Background
    ctx.clearRect(0, 0, width, heightPx);

    // Middle baseline
    const mid = Math.floor(heightPx / 2);

    // Draw base waveform
    ctx.strokeStyle = base;
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
      // Placeholder baseline if no peaks yet
      ctx.strokeStyle = base;
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(width, mid + 0.5);
      ctx.stroke();
    }

    // Buffered regions (if available)
    if (audio && audio.buffered && audio.duration) {
      ctx.strokeStyle = buffer;
      ctx.lineWidth = 2;
      for (let r = 0; r < audio.buffered.length; r++) {
        const start = audio.buffered.start(r);
        const end = audio.buffered.end(r);
        const x1 = Math.round((start / audio.duration) * width);
        const x2 = Math.round((end / audio.duration) * width);
        ctx.beginPath();
        ctx.moveTo(x1, mid);
        ctx.lineTo(x2, mid);
        ctx.stroke();
      }
    }

    // Progress overlay
    if (audio && audio.currentTime && audio.duration) {
      const progressX = Math.round((audio.currentTime / audio.duration) * width);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressX, heightPx);
      ctx.clip();

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
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
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.moveTo(0, mid + 0.5);
        ctx.lineTo(progressX, mid + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      // Playhead line
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX + 0.5, 0);
      ctx.lineTo(progressX + 0.5, heightPx);
      ctx.stroke();
    }

    // Hover scrub line
    if (hoverX !== null) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, 0);
      ctx.lineTo(hoverX + 0.5, heightPx);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [audio, peaks, hoverX, height, base, buffer, accent]);

  // Repaint on animation frame (cheap) when time updates
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      repaint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [repaint]);

  // Resize observer to keep canvas crisp
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => repaint());
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [repaint]);

  const pctToTime = useCallback((x: number) => {
    if (!audio || !audio.duration) return 0;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    return pct * audio.duration;
  }, [audio]);

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!audio) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setDragging(true);
    const t = pctToTime(e.clientX);
    audio.currentTime = t;
    onSeek?.(t);
  };
  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.min(rect.right, Math.max(rect.left, e.clientX)) - rect.left;
    setHoverX(Math.round(x));
    if (dragging && audio) {
      const t = pctToTime(e.clientX);
      audio.currentTime = t;
      onSeek?.(t);
    }
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    setDragging(false);
    setHoverX(null);
  };
  const onLeave: React.MouseEventHandler<HTMLCanvasElement> = () => {
    if (!dragging) setHoverX(null);
  };

  return (
    <Box
      position="relative"
      w="100%"
      h={`${height}px`}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="12px"
      bg="white"
      overflow="hidden"
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "pointer" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseLeave={onLeave}
      />
    </Box>
  );
}