"use client";
import { Box, VStack, Text, HStack } from "@chakra-ui/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import TranscriptJsonPanel from "./TranscriptJsonPanel";
import TranscriptPanel from "./TranscriptModal";

type TranscriptItem = { time?: string; speaker?: string; text: string };

const AudioData = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [time, setTime] = useState({ cur: 0, dur: 0 });

  // Listen for new audio URLs from InputBoxes
  useEffect(() => {
    const onAudioUrl = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url: string };
      setAudioUrl(detail.url);
    };
    window.addEventListener("audio:url", onAudioUrl as EventListener);
    return () => window.removeEventListener("audio:url", onAudioUrl as EventListener);
  }, []);

  // Load the new track
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    const a = audioRef.current;
    a.src = audioUrl;
    a.load();
    a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [audioUrl]);

  // Time / progress
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => {
      const cur = a.currentTime || 0;
      const dur = a.duration || 0;
      setTime({ cur, dur });
      setProgressPct(dur > 0 ? (cur / dur) * 100 : 0);
    };
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

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      await a.play();
      setIsPlaying(true);
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const format = (s: number) => {
    if (!isFinite(s)) return "00:00";
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
    };

  // Precompute nice spiky bars once
  const bars = useMemo(() => {
    const count = 170;
    return Array.from({ length: count }, (_, i) => {
      const t = i / count;
      const env = Math.sin(Math.PI * t);
      const ripple = Math.sin(i * 0.55) * 0.35 + Math.sin(i * 0.13) * 0.2 + Math.sin(i * 0.03) * 0.1;
      const h = Math.max(0.08, env * (0.55 + ripple));
      return Math.round(h * 70) + 10;
    });
  }, []);

  const BarRow = ({ color }: { color: string }) => (
    <HStack spacing="3px" align="end" position="absolute" top="50%" transform="translateY(-50%)" pl="4px" pr="4px">
      {bars.map((h, i) => (
        <Box key={`${color}-${i}`} w="3px" h={`${h}px`} bg={color} borderRadius="2px" />
      ))}
    </HStack>
  );

  
const sample: TranscriptItem[] = [
  {
    time: "00:00:03.250",
    speaker: "PlayByPlay",
    text: "And we’re underway, tip-off goes to the Tigers.",
  },
  {
    time: "00:00:07.900",
    speaker: "Color",
    text: "Okafor really climbed the ladder for that one.",
  },
  {
    time: "00:00:10.800",
    speaker: "PlayByPlay",
    text: "Johnson brings it across midcourt, looking to set things up.",
  },
  {
    time: "00:00:13.300",
    speaker: "PlayByPlay",
    text: "He finds Okafor near the elbow.",
  },
  {
    time: "00:00:14.200",
    speaker: "Color",
    text: "This is where he loves to operate, he’s so tough to guard there.",
  },
  {
    time: "00:00:16.000",
    speaker: "PlayByPlay",
    text: "Okafor drives right, defender stays with him.",
  },
  {
    time: "00:00:19.200",
    speaker: "PlayByPlay",
    text: "Floater in the lane… and it drops!",
  },
  {
    time: "00:00:21.000",
    speaker: "Color",
    text: "Soft touch—he makes that look easy.",
  },
  {
    time: "00:00:23.300",
    speaker: "PlayByPlay",
    text: "Tigers get a stop on the other end, pushing quickly.",
  },
  {
    time: "00:00:25.200",
    speaker: "PlayByPlay",
    text: "Johnson leading the break, dishes back to Okafor.",
  },
  {
    time: "00:00:27.100",
    speaker: "Color",
    text: "Great decision—kept the defense on its heels.",
  },
  {
    time: "00:00:29.400",
    speaker: "PlayByPlay",
    text: "Okafor spins to the left hand, rises for the jumper…",
  },
  {
    time: "00:00:36.300",
    speaker: "PlayByPlay",
    text: "And it’s good! Tigers extend their lead.",
  },
  {
    time: "00:00:38.100",
    speaker: "Color",
    text: "That’s six quick points from Okafor—what a start.",
  },
];

  return (
    <>
      <VStack w="100%" px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
        <Box w="100%">
          <Text fontFamily="poppins" fontWeight={600} color="black" fontSize="20px">
            Audio Data
          </Text>
        </Box>

        <HStack justify="center" align="start" w="100%" flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}>
          <Box
            mb="50px"
            fontSize="13px"
            lineHeight="1.6"
            bg="white"
            color="black"
            borderWidth="1px"
            borderColor="gray.300"
            borderRadius="12px"
            p="12px"
            w="100%"
            boxShadow="md"
          >
            <HStack align="stretch" spacing={4} w="100%">
              {/* PLAY/PAUSE */}
              <Box
                as="button"
                onClick={togglePlay}
                disabled={!audioUrl}
                w="72px"
                minW="72px"
                h="110px"
                borderRadius="10px"
                borderWidth="1px"
                borderColor="gray.300"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={audioUrl ? "gray.50" : "gray.100"}
                _hover={{ bg: audioUrl ? "gray.200" : "gray.100" }}
              >
                <Text fontSize="24px">{isPlaying ? "⏸" : "▶"}</Text>
              </Box>

              {/* RIGHT SIDE */}
              <VStack align="start" spacing={3} w="100%">
                {/* Waveform */}
                <Box position="relative" w="100%" h="110px" borderWidth="1px" borderColor="gray.200" borderRadius="8px" bg="gray.50" overflow="hidden">
                  <BarRow color="orange.200" />
                  <Box position="absolute" top="0" left="0" h="100%" w={`${progressPct}%`} overflow="hidden">
                    <BarRow color="orange.400" />
                  </Box>
                </Box>

                {/* Controls row */}
                <HStack justify="space-between" align="center" w="100%">
                  <Text fontSize="12px" color="gray.600">
                    {format(time.cur)} / {format(time.dur)}
                  </Text>
                </HStack>
              </VStack>
            </HStack>

            {/* Hidden audio element */}
            <audio ref={audioRef} preload="auto" />

           
          </Box>
           
        </HStack>
         <VStack w="full">
          <HStack
            justify="center"
            align="stretch"
            w={["100%", "100%", "100%", "100%", "100%", "100%"]}
            flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
            spacing={4}
          >
            <TranscriptJsonPanel title="Raw Transcript" lines={sample} h={500} />
            <TranscriptPanel title="Transcript Timeline " lines={sample} h={500} />
          </HStack>
        </VStack>
      </VStack>
    </>
  );
};

export default AudioData;
