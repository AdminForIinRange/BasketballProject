import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Box, Button, HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import { WaveformCanvas } from "./WaveformCanvas";
import { Clip, Track, Line } from "./types";
import {
  fmt,
  parseTranscriptJSON,
  getDuration,
  stableId,
  toSec,
  roleOf,
} from "./utils";

const AudioTimelinePage = () => {
  /* -------- UI constants -------- */
  const timelineWidth = 960; // px
  const laneHeight = 84;
  const clipHeight = 60;
  const timelinePaddingY = 12;
  const trackLabelWidth = 120;
  const gridSegments = 12;

  /* -------- state -------- */
  const [raw, setRaw] = useState<string>("[]");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [building, setBuilding] = useState(false);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const [curIndex, setCurIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [curDur, setCurDur] = useState(0);

  const dragInfo = useRef<{
    trackId: "A" | "B";
    clipId: string;
    grabX: number;
  } | null>(null);

  /* -------- derived -------- */
  const totalDuration = useMemo(() => {
    const ends = tracks.flatMap((t) =>
      t.clips.map((c) => c.startTime + c.duration),
    );
    return ends.length ? Math.max(...ends) : 0;
  }, [tracks]);

  const linear = useMemo(
    () =>
      tracks
        .flatMap((t) => t.clips.map((c) => ({ ...c, _track: t.id })))
        .filter((c) => c.url)
        .sort((a, b) => a.startTime - b.startTime),
    [tracks],
  );

  /* -------- helpers -------- */
  const getClipWidth = useCallback(
    (duration: number) => {
      if (totalDuration === 0) return 0;
      const minWidth = 96;
      const px = (duration / totalDuration) * timelineWidth;
      return Math.max(px, minWidth);
    },
    [timelineWidth, totalDuration],
  );

  const getClipLeft = useCallback(
    (start: number) => {
      if (totalDuration === 0) return 0;
      return (start / totalDuration) * timelineWidth;
    },
    [timelineWidth, totalDuration],
  );

  const pxToTime = useCallback(
    (px: number) => {
      if (totalDuration === 0) return 0;
      return (px / timelineWidth) * totalDuration;
    },
    [timelineWidth, totalDuration],
  );

  const snapNonOverlap = useCallback(
    (track: Track, clipId: string, proposedStart: number) => {
      const clip = track.clips.find((c) => c.id === clipId)!;
      const others = track.clips
        .filter((c) => c.id !== clipId)
        .sort((a, b) => a.startTime - b.startTime);
      const prev = [...others]
        .reverse()
        .find((c) => c.startTime + c.duration <= proposedStart);
      const next = others.find((c) => c.startTime >= proposedStart);
      const minStart = prev ? prev.startTime + prev.duration : 0;
      const maxStart = next ? next.startTime - clip.duration : Infinity;
      return Math.max(minStart, Math.min(proposedStart, maxStart));
    },
    [],
  );

  /* -------- build from transcript -------- */
  const handleBuild = useCallback(async () => {
    setBuilding(true);
    try {
      const lines = parseTranscriptJSON(raw);
      const built = await Promise.all(
        lines.map(async (l, i) => {
          const res = await fetch("/api/playai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: l.text,
              speaker: l.speaker,
              time: l.time,
            }),
          });
          const data = await res.json();
          const url: string | null = data?.audio?.url ?? null;
          const dur = url ? await getDuration(url) : 0;

          const role = roleOf(l.speaker);
          const startTime = toSec(l.time) + i * 0.001;
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
          };
        }),
      );

      const A: Track = { id: "A", name: "Track A", clips: [] };
      const B: Track = { id: "B", name: "Track B", clips: [] };
      for (const s of built.sort((a, b) => a.startTime - b.startTime)) {
        (s.lane === "A" ? A : B).clips.push(s);
      }
      setTracks([A, B]);
      setCurIndex(-1);
      setPlaying(false);
    } catch (e) {
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
    [linear],
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

  /* -------- drag handlers -------- */
  const onClipPointerDown =
    (track: Track, clip: Clip) => (e: React.PointerEvent<HTMLDivElement>) => {
      const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const grabX = e.clientX - box.left; // px inside clip where grabbed
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragInfo.current = { trackId: track.id, clipId: clip.id, grabX };
    };

  const onClipPointerMove =
    (track: Track, clip: Clip) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragInfo.current || dragInfo.current.clipId !== clip.id) return;
      // compute proposed left by aligning grab point to mouse X
      const laneBox = (
        e.currentTarget.parentElement!.parentElement! as HTMLDivElement
      ).getBoundingClientRect(); // outer timeline
      const x = e.clientX - laneBox.left - dragInfo.current.grabX;
      const proposedStart = Math.max(0, pxToTime(x));
      const snapped = snapNonOverlap(track, clip.id, proposedStart);
      setTracks((prev) =>
        prev.map((t) =>
          t.id !== track.id
            ? t
            : {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clip.id ? { ...c, startTime: snapped } : c,
                ),
              },
        ),
      );
    };

  const onClipPointerUp = () => {
    dragInfo.current = null;
  };

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

      <Box
        position="relative"
        bg="gray.50"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        px="0"
        py={`${timelinePaddingY}px`}
        width={`${timelineWidth}px`}
      >
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
                <Text
                  fontSize="xs"
                  color="white"
                  opacity={0.9}
                  ml={3}
                  whiteSpace="nowrap"
                >
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
    <VStack
      spacing={8}
      p={8}
      align="stretch"
      w={"100%"}
      px={["4%", "4%", "6%", "8%", "16%", "16%"]}
      bg="white"
      minH="100vh"
    >
      {/* Input / Build */}
      <Box
        bg="white"
        p={6}
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="lg"
      >
        <Text fontSize="xl" fontWeight="bold" mb={3} color="gray.700">
          Transcript JSON
        </Text>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          fontSize="13px"
          h="200px"
          placeholder='[{"time":"00:00:03.250","speaker":"PlayByPlay","text":"Tip-off..."}, ...]'
        />
        <HStack mt={3}>
          <Button
            colorScheme="orange"
            onClick={handleBuild}
            isDisabled={building}
          >
            {building ? "Building…" : "Build Segments"}
          </Button>
          <Text fontSize="sm" color="gray.600" ml="auto">
            {tracks.reduce((n, t) => n + t.clips.length, 0)
              ? `Clips: ${tracks.reduce((n, t) => n + t.clips.length, 0)}`
              : ""}
          </Text>
        </HStack>
      </Box>

      {/* Transport */}
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
          <Button
            onClick={() =>
              curIndex <= 0 ? setCurIndex(-1) : loadAndPlay(curIndex - 1)
            }
            isDisabled={!linear.length}
          >
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
          <Button
            onClick={() => loadAndPlay(curIndex < 0 ? 0 : curIndex + 1)}
            isDisabled={!linear.length}
          >
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
            {curIndex >= 0 ? `Seg ${curIndex + 1}/${linear.length}` : `Idle`} •{" "}
            {fmt(curTime)} / {fmt(curDur)}
          </Text>
        </HStack>
        <audio ref={masterAudioRef} preload="auto" />
      </Box>

      {/* Timeline */}
      <Box
        bg="white"
        p={6}
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="lg"
      >
        <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
          Timeline
        </Text>
        <VStack spacing={4} align="stretch">
          {tracks.map(renderTrack)}
        </VStack>
      </Box>
    </VStack>
  );
};

export default AudioTimelinePage;
