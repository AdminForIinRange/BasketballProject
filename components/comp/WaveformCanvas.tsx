import React, { useCallback, useEffect, useRef } from "react";
import { Box } from "@chakra-ui/react";

interface WaveformCanvasProps {
  src: string | null;
  height?: number;
  baseColor?: string;
  progressColor?: string;
  bg?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  src,
  height = 60,
  baseColor = "#E2E8F0",
  progressColor = "#3182CE",
  bg = "#FFFFFF",
}) => {
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
  }, [height, baseColor, bg]);

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
      borderColor="gray.200"
      borderRadius="10px"
      overflow="hidden"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </Box>
  );
};
