"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AudioClip {
  id: string;
  person: string;
  duration: number;
  startTime: number;
  content: string;
  color: string;
}

interface Track {
  id: string;
  name: string;
  clips: AudioClip[];
}

export default function VideoEditor() {
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: "A",
      name: "Track A",
      clips: [
        {
          id: "1",
          person: "Audio 1",
          duration: 120,
          startTime: 0,
          content: "Welcome to our podcast...",
          color: "blue",
        },
        {
          id: "2",
          person: "Audio 2",
          duration: 80,
          startTime: 140,
          content: "Thanks for having me...",
          color: "green",
        },
        {
          id: "4",
          person: "Person 4",
          duration: 60,
          startTime: 240,
          content: "That's interesting...",
          color: "purple",
        },
      ],
    },
    {
      id: "B",
      name: "Track B",
      clips: [
        {
          id: "3",
          person: "Audio 3",
          duration: 100,
          startTime: 20,
          content: "I think we should...",
          color: "orange",
        },
        {
          id: "5",
          person: "Person 5",
          duration: 150,
          startTime: 140,
          content: "Let me explain this...",
          color: "teal",
        },
        {
          id: "6",
          person: "Person 6",
          duration: 90,
          startTime: 310,
          content: "Great point about...",
          color: "red",
        },
      ],
    },
  ]);

  const [selectedClip, setSelectedClip] = useState<AudioClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // --- Presentation constants (single source of truth) ---
  const timelineWidth = 960; // px
  const laneHeight = 84; // px
  const clipHeight = 60; // px
  const timelinePaddingY = 12; // px
  const trackLabelWidth = 120; // px
  const gridSegments = 12;
  const gapBetweenClips = 10; // seconds

  // --- GLOBAL overlap resolution (prevents overlap across BOTH tracks) ---
  // We shift startTimes forward so that no two clips anywhere overlap in time.
  const resolveOverlapsGlobally = useCallback((allTracks: Track[]): Track[] => {
    // Flatten with track reference
    const flat = allTracks.flatMap((t) =>
      t.clips.map(
        (c) => ({ ...c, __trackId: t.id }) as AudioClip & { __trackId: string },
      ),
    );
    // Sort by start then duration to maintain relative order as much as possible
    flat.sort((a, b) => a.startTime - b.startTime || a.duration - b.duration);

    let lastEnd = 0;
    const adjusted: (AudioClip & { __trackId: string })[] = [];

    for (const clip of flat) {
      const desired = Math.max(clip.startTime, lastEnd);
      const newStart = desired + (adjusted.length > 0 ? gapBetweenClips : 0); // small gap between ALL clips globally
      const finalStart =
        adjusted.length === 0
          ? clip.startTime
          : Math.max(clip.startTime, newStart);
      lastEnd = finalStart + clip.duration;
      adjusted.push({ ...clip, startTime: finalStart });
    }

    // Put back into their tracks
    return allTracks.map((t) => ({
      ...t,
      clips: adjusted
        .filter((c) => c.__trackId === t.id)
        .map(({ __trackId, ...rest }) => rest),
    }));
  }, []);

  const processedTracks = useMemo(
    () => resolveOverlapsGlobally(tracks),
    [tracks, resolveOverlapsGlobally],
  );

  const totalDuration = useMemo(() => {
    const ends = processedTracks.flatMap((track) =>
      track.clips.map((clip) => clip.startTime + clip.duration),
    );
    return Math.max(0, ...ends);
  }, [processedTracks]);

  // --- Playback (simple, smooth, bounded) ---
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        const next = t + dt;
        if (next >= totalDuration) {
          // stop at the end
          return totalDuration;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, totalDuration]);

  const handlePlayPause = useCallback(() => {
    // if at end, restart
    setCurrentTime((t) => (t >= totalDuration ? 0 : t));
    setIsPlaying((p) => !p);
  }, [totalDuration]);

  const handleClipClick = useCallback(
    (clip: AudioClip) => setSelectedClip(clip),
    [],
  );

  const updateClipContent = useCallback(
    (clipId: string, newContent: string) => {
      setTracks((prev) =>
        prev.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, content: newContent } : clip,
          ),
        })),
      );
    },
    [],
  );

  // --- Timeline math helpers ---
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

  const playheadLeft = useMemo(
    () => getClipLeft(currentTime),
    [currentTime, getClipLeft],
  );

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  // Click / scrub on the timeline area
  const onScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (totalDuration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / timelineWidth));
      setCurrentTime(ratio * totalDuration);
    },
    [timelineWidth, totalDuration],
  );

  // --- UI subviews ---
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
            {formatTime(t)}
          </Text>
        </Box>
      );
    });
    return (
      <Box position="absolute" inset="0">
        {labels}
      </Box>
    );
  }, [gridSegments, timelineWidth, totalDuration, formatTime]);

  const renderTrack = useCallback(
    (track: Track) => (
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
          onClick={onScrub}
        >
          {/* grid & ruler */}
          <Box position="relative" height={`${laneHeight}px`}>
            <Ruler />

            {/* clips */}
            {track.clips.map((clip) => (
              <Box
                key={clip.id}
                position="absolute"
                top={`${(laneHeight - clipHeight) / 2}px`}
                left={`${getClipLeft(clip.startTime)}px`}
                width={`${getClipWidth(clip.duration)}px`}
                height={`${clipHeight}px`}
                bg={
                  selectedClip?.id === clip.id
                    ? `${clip.color}.500`
                    : `${clip.color}.400`
                }
                border="2px solid"
                borderColor={
                  selectedClip?.id === clip.id
                    ? `${clip.color}.700`
                    : `${clip.color}.500`
                }
                borderRadius="md"
                boxShadow="sm"
                cursor="pointer"
                transition="transform 0.15s ease"
                _hover={{ transform: "translateY(-2px)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClipClick(clip);
                }}
                overflow="hidden"
                px={3}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
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
                  {clip.duration}s
                </Text>
              </Box>
            ))}

            {/* playhead */}
            <Box
              position="absolute"
              top="0"
              bottom="0"
              left={`${playheadLeft}px`}
              width="2px"
              bg="blue.600"
              boxShadow="0 0 0 1px rgba(0,0,0,0.06)"
            />
          </Box>
        </Box>
      </HStack>
    ),
    [selectedClip, getClipLeft, getClipWidth, playheadLeft, onScrub, Ruler],
  );

  return (
    <VStack
      spacing={8}
      p={8}
      align="stretch"
      maxW="1200px"
      mx="auto"
      bg="white"
      minH="100vh"
    >
      <Box
        textAlign="center"
        py={6}
        bg="gray.900"
        color="white"
        borderRadius="xl"
      >
        <Text fontSize="3xl" fontWeight="bold" letterSpacing="wide">
          Audio Timeline Editor
        </Text>
        <Text fontSize="sm" opacity={0.8} mt={1}>
          Professional multi-track audio editing interface
        </Text>
      </Box>

      <HStack
        spacing={6}
        justify="space-between"
        p={4}
        bg="gray.100"
        borderRadius="lg"
      >
        <HStack spacing={4}>
          <Button
            colorScheme="blue"
            onClick={handlePlayPause}
            size="lg"
            leftIcon={<Text>{isPlaying ? "⏸️" : "▶️"}</Text>}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Box
            bg="white"
            px={4}
            py={2}
            borderRadius="md"
            border="1px solid"
            borderColor="gray.300"
            minW="170px"
            textAlign="center"
          >
            <Text fontSize="lg" fontWeight="semibold">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </Text>
          </Box>
        </HStack>
        <Text fontSize="sm" color="gray.600">
          Click the timeline to scrub
        </Text>
      </HStack>

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
          {processedTracks.map(renderTrack)}
        </VStack>
      </Box>

      {selectedClip && (
        <Box
          p={6}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          bg="gray.50"
        >
          <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
            Editing: {selectedClip.person}
          </Text>
          <VStack spacing={4} align="stretch">
            <HStack spacing={6}>
              <Box
                bg="white"
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                minW="140px"
              >
                <Text fontSize="xs" color="gray.600">
                  Duration
                </Text>
                <Text fontSize="lg" fontWeight="bold">
                  {selectedClip.duration}s
                </Text>
              </Box>
              <Box
                bg="white"
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                minW="140px"
              >
                <Text fontSize="xs" color="gray.600">
                  Start Time
                </Text>
                <Text fontSize="lg" fontWeight="bold">
                  {selectedClip.startTime}s
                </Text>
              </Box>
            </HStack>

            <VStack align="stretch">
              <Text fontWeight="semibold" color="gray.700">
                Content
              </Text>
              <Textarea
                value={selectedClip.content}
                onChange={(e) =>
                  updateClipContent(selectedClip.id, e.target.value)
                }
                placeholder="Enter audio content or transcript..."
                rows={4}
                bg="white"
                border="1px solid"
                borderColor="gray.200"
                _focus={{ borderColor: `${selectedClip.color}.400` }}
              />
            </VStack>
          </VStack>
        </Box>
      )}

      <Box
        p={6}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        bg="gray.50"
      >
        <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
          Project Statistics
        </Text>
        <VStack spacing={3} align="stretch">
          {processedTracks.map((track) => (
            <HStack
              key={track.id}
              justify="space-between"
              p={3}
              bg="white"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.100"
            >
              <Text fontWeight="semibold">{track.name}</Text>
              <Text color="gray.600">{track.clips.length} clips</Text>
            </HStack>
          ))}
          <HStack
            justify="space-between"
            p={3}
            bg="white"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.200"
          >
            <Text fontWeight="bold" fontSize="lg">
              Total Duration
            </Text>
            <Text fontWeight="bold" fontSize="lg" color="blue.600">
              {formatTime(totalDuration)}
            </Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
