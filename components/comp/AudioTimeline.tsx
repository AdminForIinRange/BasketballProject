"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";

/* ==================== Types ==================== */
type Line = { time?: string; speaker?: string; text: string };

type Clip = {
  id: string;
  person: string;
  startTime: number;   // seconds from 0
  duration: number;    // seconds
  content: string;
  color: string;       // chakra color name (base)
  url: string | null;  // TTS audio URL
};

type Track = { id: "A" | "B"; name: string; clips: Clip[] };

/* ==================== Utils ==================== */
const stableId = (p = "id") =>
  `${p}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-4)}`;

const fmt = (n: number) => {
  const m = Math.floor(n / 60).toString().padStart(2, "0");
  const s = Math.floor(n % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const toSec = (tc?: string) => {
  if (!tc) return 0;
  const parts = tc.split(":");
  const hhmmss = parts.length === 3 ? parts : ["00", ...parts];
  const [hh, mm, ss] = hhmmss;
  const s = parseFloat(ss || "0");
  const m = parseInt(mm || "0");
  const h = parseInt(hh || "0");
  return h * 3600 + m * 60 + s;
};

const roleOf = (s?: string): "PlayByPlay" | "Color" =>
  (s || "").toLowerCase().includes("color") ? "Color" : "PlayByPlay";

/** probe duration of a URL without playing */
const getDuration = (url: string) =>
  new Promise<number>((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
  });

/** parse user JSON safely */
function parseTranscriptJSON(raw: string): Line[] {
  let parsed: any;
  parsed = JSON.parse(raw);
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

/* ==================== Mini Waveform ==================== */
function WaveformCanvas({
  src,
  height = 60,
  baseColor = "#E2E8F0",
  progressColor = "#3182CE",
  bg = "#FFFFFF",
}: {
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
    <Box w="100%" h={`${height}px`} borderWidth="1px" borderColor="gray.200" borderRadius="10px" overflow="hidden">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </Box>
  );
}

/* ==================== Main ==================== */
export default function AudioTimelinePage() {
  /* -------- UI constants -------- */
  const timelineWidth = 960; // px
  const laneHeight = 84;
  const clipHeight = 60;
  const timelinePaddingY = 12;
  const trackLabelWidth = 120;
  const gridSegments = 12;

  /* -------- state -------- */
  const [raw, setRaw] = useState<string>(
    JSON.stringify(
      [
        { time: "00:00:03.250", speaker: "PlayByPlay", text: "Tip-off won by the Tigers." },
        { time: "00:00:07.900", speaker: "Color", text: "Great vertical from Okafor there." },
        { time: "00:00:10.200", speaker: "PlayByPlay", text: "Johnson brings it over the logo, sets the table for the first set." },
        { time: "00:00:12.850", speaker: "Color", text: "Look for an early touch to Okafor at the elbow—he’s comfortable facing up." },
        { time: "00:00:15.300", speaker: "PlayByPlay", text: "High screen from Carter, Johnson snakes right, bounce pass to Okafor." },
        { time: "00:00:18.100", speaker: "PlayByPlay", text: "Okafor jab step, one dribble… soft floater from eight feet—good! [score: TIG 2–0]" },
        { time: "00:00:20.000", speaker: "Color", text: "That’s touch. He sells the jab and keeps the defender on his heels." },
      ],
      null,
      2
    )
  );

  const [tracks, setTracks] = useState<Track[]>([
    { id: "A", name: "Track A", clips: [] },
    { id: "B", name: "Track B", clips: [] },
  ]);
  const [building, setBuilding] = useState(false);

  // master transport
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const [curIndex, setCurIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [curDur, setCurDur] = useState(0);

  // dragging
  const dragInfo = useRef<{ trackId: "A" | "B"; clipId: string; grabX: number } | null>(null);

  /* -------- derived -------- */
  const totalDuration = useMemo(() => {
    const ends = tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.duration));
    return ends.length ? Math.max(...ends) : 0;
  }, [tracks]);

  const linear = useMemo(
    () =>
      tracks
        .flatMap((t) => t.clips.map((c) => ({ ...c, _track: t.id })))
        .filter((c) => c.url)
        .sort((a, b) => a.startTime - b.startTime),
    [tracks]
  );

  /* -------- helpers -------- */
  const getClipWidth = useCallback(
    (duration: number) => {
      if (totalDuration === 0) return 0;
      const minWidth = 96;
      const px = (duration / totalDuration) * timelineWidth;
      return Math.max(px, minWidth);
    },
    [timelineWidth, totalDuration]
  );

  const getClipLeft = useCallback(
    (start: number) => {
      if (totalDuration === 0) return 0;
      return (start / totalDuration) * timelineWidth;
    },
    [timelineWidth, totalDuration]
  );

  const pxToTime = useCallback(
    (px: number) => {
      if (totalDuration === 0) return 0;
      return (px / timelineWidth) * totalDuration;
    },
    [timelineWidth, totalDuration]
  );

  const snapNonOverlap = useCallback((track: Track, clipId: string, proposedStart: number) => {
    const clip = track.clips.find((c) => c.id === clipId)!;
    const others = track.clips
      .filter((c) => c.id !== clipId)
      .sort((a, b) => a.startTime - b.startTime);
    const prev = [...others].reverse().find((c) => c.startTime + c.duration <= proposedStart);
    const next = others.find((c) => c.startTime >= proposedStart);
    const minStart = prev ? prev.startTime + prev.duration : 0;
    const maxStart = next ? next.startTime - clip.duration : Infinity;
    return Math.max(minStart, Math.min(proposedStart, maxStart));
  }, []);

  /* -------- build from transcript -------- */
  const handleBuild = useCallback(async () => {
    setBuilding(true);
    try {
      const lines = parseTranscriptJSON(raw);

      const built = await Promise.all(
        lines.map(async (l, i) => {
          // call your own API that wraps Play.ai (replace this with real call)
          const res = await fetch("/api/playai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: l.text, speaker: l.speaker, time: l.time }),
          });
          const data = await res.json();
          const url: string | null = data?.audio?.url ?? null;
          const dur = url ? await getDuration(url) : 0;

          const role = roleOf(l.speaker);
          const startTime = toSec(l.time) + (i * 0.001); // tiny epsilon to avoid equal timestamps
          const color = role === "Color" ? "purple" : "blue";
          return {
            id: stableId("seg"),
            person: l.speaker || role,
            startTime,
            duration: Math.max(0.1, dur),
            content: l.text,
            color,
            url,
            lane: role === "Color" ? "B" : "A",
          } as const;
        })
      );

      const A: Track = { id: "A", name: "Track A", clips: [] };
      const B: Track = { id: "B", name: "Track B", clips: [] };
      for (const s of built.sort((a, b) => a.startTime - b.startTime)) {
        (s.lane === "A" ? A : B).clips.push({
          id: s.id,
          person: s.person,
          startTime: s.startTime,
          duration: s.duration,
          content: s.content,
          color: s.color,
          url: s.url,
        });
      }
      setTracks([A, B]);
      setCurIndex(-1);
      setPlaying(false);
    } catch (e: any) {
      alert(e?.message || "Failed to build segments.");
    } finally {
      setBuilding(false);
    }
  }, [raw]);

  /* -------- master transport -------- */
  const loadAndPlay = useCallback(
    async (i: number) => {
      const a = masterAudioRef.current;
      if (!a) return;
      if (i < 0 || i >= linear.length) {
        setCurIndex(-1);
        setPlaying(false);
        return;
      }
      const seg = linear[i];
      if (!seg.url) {
        loadAndPlay(i + 1);
        return;
      }
      a.src = seg.url;
      try {
        await a.play();
        setCurIndex(i);
        setPlaying(true);
      } catch {
        setCurIndex(i);
        setPlaying(!a.paused);
      }
    },
    [linear]
  );

  const onEnded = useCallback(() => {
    const next = curIndex + 1;
    if (next < linear.length) loadAndPlay(next);
    else {
      setPlaying(false);
      setCurIndex(-1);
    }
  }, [curIndex, linear, loadAndPlay]);

  useEffect(() => {
    const a = masterAudioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurTime(a.currentTime || 0);
      setCurDur(a.duration || 0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [onEnded]);

  /* -------- timeline ruler -------- */
  const Ruler = useCallback(() => {
    const labels = Array.from({ length: gridSegments + 1 }, (_, i) => {
      const t = (i / gridSegments) * totalDuration;
      const left = (i / gridSegments) * timelineWidth;
      return (
        <Box key={i} position="absolute" left={`${left}px`} top="0" bottom="0">
          <Box width="1px" height="100%" bg="gray.200" />
          <Text mt={1} ml={2} fontSize="xs" color="gray.500" position="absolute" top="0" transform="translateY(-100%)">
            {fmt(t)}
          </Text>
        </Box>
      );
    });
    return <Box position="absolute" inset="0">{labels}</Box>;
  }, [gridSegments, timelineWidth, totalDuration]);

  /* -------- drag handlers -------- */
  const onClipPointerDown = (track: Track, clip: Clip) => (e: React.PointerEvent<HTMLDivElement>) => {
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const grabX = e.clientX - box.left; // px inside clip where grabbed
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragInfo.current = { trackId: track.id, clipId: clip.id, grabX };
  };

  const onClipPointerMove = (track: Track, clip: Clip) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragInfo.current || dragInfo.current.clipId !== clip.id) return;
    // compute proposed left by aligning grab point to mouse X
    const laneBox = (e.currentTarget.parentElement!.parentElement! as HTMLDivElement).getBoundingClientRect(); // outer timeline
    const x = e.clientX - laneBox.left - dragInfo.current.grabX;
    const proposedStart = Math.max(0, pxToTime(x));
    const snapped = snapNonOverlap(track, clip.id, proposedStart);
    setTracks((prev) =>
      prev.map((t) =>
        t.id !== track.id
          ? t
          : {
              ...t,
              clips: t.clips.map((c) => (c.id === clip.id ? { ...c, startTime: snapped } : c)),
            }
      )
    );
  };

  const onClipPointerUp = () => {
    dragInfo.current = null;
  };

  /* -------- render -------- */
  const renderTrack = (track: Track) => (
    <HStack key={track.id} align="stretch" spacing={4}>
      <Box
        minW={`${trackLabelWidth}px`}
        maxW={`${trackLabelWidth}px`}
        height={`${laneHeight + timelinePaddingY * 2}px`}
        bg="gray.800"
        color="white"
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
      >
        {track.name}
      </Box>

      <Box position="relative" bg="gray.50" border="1px solid" borderColor="gray.200" borderRadius="md" px="0" py={`${timelinePaddingY}px`} width={`${timelineWidth}px`}>
        <Box position="relative" height={`${laneHeight}px`}>
          <Ruler />

          {track.clips.map((clip) => (
            <Box
              key={clip.id}
              position="absolute"
              top={`${(laneHeight - clipHeight) / 2}px`}
              left={`${getClipLeft(clip.startTime)}px`}
              width={`${getClipWidth(clip.duration)}px`}
              height={`${clipHeight}px`}
              bg={`${clip.color}.400`}
              border="2px solid"
              borderColor={`${clip.color}.600`}
              borderRadius="md"
              boxShadow="sm"
              cursor="grab"
              overflow="hidden"
              px={3}
              display="flex"
              flexDir="column"
              justifyContent="center"
              onPointerDown={onClipPointerDown(track, clip)}
              onPointerMove={onClipPointerMove(track, clip)}
              onPointerUp={onClipPointerUp}
              onPointerCancel={onClipPointerUp}
            >
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="bold" color="white" isTruncated>
                  {clip.person}
                </Text>
                <Text fontSize="xs" color="white" opacity={0.9} ml={3} whiteSpace="nowrap">
                  {Math.round(clip.duration)}s
                </Text>
              </HStack>

              <Box mt={1}>
                <WaveformCanvas
                  src={clip.url}
                  height={40}
                  baseColor="#E2E8F0"
                  progressColor="#3182CE"
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </HStack>
  );

  return (
    <VStack spacing={8} p={8} align="stretch" maxW="1200px" mx="auto" bg="white" minH="100vh">
      <Box textAlign="center" py={6} bg="gray.900" color="white" borderRadius="xl">
        <Text fontSize="3xl" fontWeight="bold" letterSpacing="wide">Audio Timeline Editor</Text>
        <Text fontSize="sm" opacity={0.8} mt={1}>Two-lane, non-overlapping clips with mini waveforms</Text>
      </Box>

      {/* Input / Build */}
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" boxShadow="lg">
        <Text fontSize="xl" fontWeight="bold" mb={3} color="gray.700">Transcript JSON</Text>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          fontSize="13px"
          h="200px"
          placeholder='[{"time":"00:00:03.250","speaker":"PlayByPlay","text":"Tip-off..."}, ...]'
        />
        <HStack mt={3}>
          <Button colorScheme="orange" onClick={handleBuild} isDisabled={building}>
            {building ? "Building…" : "Build Segments"}
          </Button>
          <Text fontSize="sm" color="gray.600" ml="auto">
            {tracks.reduce((n, t) => n + t.clips.length, 0) ? `Clips: ${tracks.reduce((n, t) => n + t.clips.length, 0)}` : ""}
          </Text>
        </HStack>
      </Box>

      {/* Transport */}
      <Box w="100%" bg="white" borderWidth="1px" borderColor="gray.300" borderRadius="12px" p="16px" boxShadow="md">
        <HStack spacing={3} mb={2}>
          <Button onClick={() => (curIndex <= 0 ? setCurIndex(-1) : loadAndPlay(curIndex - 1))} isDisabled={!linear.length}>
            Prev
          </Button>
          <Button
            onClick={() => {
              if (!linear.length) return;
              if (playing) {
                masterAudioRef.current?.pause();
                setPlaying(false);
              } else {
                loadAndPlay(curIndex === -1 ? 0 : curIndex);
              }
            }}
            isDisabled={!linear.length}
          >
            {playing ? "Pause" : curIndex === -1 ? "Play All" : "Resume"}
          </Button>
          <Button onClick={() => loadAndPlay(curIndex < 0 ? 0 : curIndex + 1)} isDisabled={!linear.length}>
            Next
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const a = masterAudioRef.current;
              if (!a) return;
              a.pause();
              a.currentTime = 0;
              setCurIndex(-1);
              setPlaying(false);
              setCurTime(0);
              setCurDur(0);
            }}
            isDisabled={!linear.length}
          >
            Stop
          </Button>
          <Text fontSize="sm" color="gray.600" ml="auto">
            {curIndex >= 0 ? `Seg ${curIndex + 1}/${linear.length}` : `Idle`} • {fmt(curTime)} / {fmt(curDur)}
          </Text>
        </HStack>
        <audio ref={masterAudioRef} preload="auto" />
      </Box>

      {/* Timeline */}
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" boxShadow="lg">
        <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">Timeline</Text>
        <VStack spacing={4} align="stretch">
          {tracks.map(renderTrack)}
        </VStack>
      </Box>
    </VStack>
  );
}
