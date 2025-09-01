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
import { PauseIcon, PlayIcon, SkipBack, SkipForward } from "lucide-react";

const AudioTimelinePage = () => {
  /* -------- UI constants -------- */
  const initialTimelineWidth = 960; // px (no longer needs dynamic changes)
  const laneHeight = 84;
  const clipHeight = 60;
  const timelinePaddingY = 12;
  const trackLabelWidth = 160; // More space for track labels
  const gridSegments = 12;

  /* -------- state -------- */
  const [raw, setRaw] = useState<string>(
    `[
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


`
  );
  const [tracks, setTracks] = useState<Track[]>([]);
  const [building, setBuilding] = useState(false);
  const [timelineWidth] = useState(initialTimelineWidth); // Fixed timeline width
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
      t.clips.map((c) => c.startTime + c.duration)
    );
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
    []
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
          const startTime = toSec(l.time) + i * 0.001; // tiny epsilon to avoid equal timestamps
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
        })
      );

      const A: Track = { id: "A", name: "PlayByPlay", clips: [] };
      const B: Track = { id: "B", name: "Color", clips: [] };
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
          <Text
            mt={1}
            ml={2}
            fontSize="xs"
            color="gray.500"
            position="absolute"
            top="0"
            transform="translateY(-100%)"
          >
            {fmt(t)}
          </Text>
        </Box>
      );
    });
    return (
      <Box position="absolute" inset="0">
        {labels}
      </Box>
    );
  }, [gridSegments, timelineWidth, totalDuration]);

  const renderTrack = (track: Track) => (
    <HStack key={track.id} align="stretch" spacing={4}>
      <Box
        w={"80px"}
        height={`${laneHeight + timelinePaddingY * 2}px`}
        bg="gray.800"
        color="white"
        fontSize={"12px"}
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
        borderRadius="md"
        px="0"
        py={`${timelinePaddingY}px`}
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
            >
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
      align="stretch"
      w={"100%"}
      px={["4%", "4%", "6%", "8%", "16%", "16%"]}
      bg="white"
      minH="100vh"
    >
      <Box w="100%">
        <Text
          fontFamily="poppins"
          fontWeight={600}
          color="black"
          fontSize="20px"
          mt="10px"
        >
          Timeline Audio Segmentation
        </Text>
      </Box>
      {/* Input / Build */}
      <Box
        bg="white"
        p={4}
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="lg"
      >
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          borderRadius="24px"
                aria-label="Paste JSON with timestamps"
              
                placeholder={`[
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

`}
                spellCheck={false}
                resize="none"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
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
        />
        <HStack mt={3}>
          <Button
            bg={"orange.400"}
            fontFamily="poppins"
            fontWeight={600}
            onClick={handleBuild}
            isDisabled={building}
          >
            {building ? "Building…" : "Segment Audio"}
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
            bg={"orange.400"}
            onClick={() =>
              curIndex <= 0 ? setCurIndex(-1) : loadAndPlay(curIndex - 1)
            }
            isDisabled={!linear.length}
          >
            <SkipBack />
          </Button>
          <Button
            bg={"orange.400"}
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
            {playing ? (
              <PauseIcon />
            ) : curIndex === -1 ? (
              <PlayIcon />
            ) : (
              <PlayIcon />
            )}
          </Button>
          <Button
            bg={"orange.400"}
            onClick={() => loadAndPlay(curIndex < 0 ? 0 : curIndex + 1)}
            isDisabled={!linear.length}
          >
            <SkipForward />
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
        overflowX="auto" // Horizontal scrolling enabled
        whiteSpace="nowrap"
      >
        <VStack spacing={4} align="stretch">
          {tracks.length > 0 ? (
            tracks.map(renderTrack)
          ) : (
            <Text color="gray.500" fontSize="sm" textAlign="center">
              Press "Segment Audio" to create a timeline.
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  );
};

export default AudioTimelinePage;
