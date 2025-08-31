"use client";
import React, { useEffect, useMemo, useRef } from "react";
import { Box, VStack, Text, HStack } from "@chakra-ui/react";

type Line = { time: string; speaker: string; text: string };

type Props = {
  title?: string;
  lines: Line[];
  h?: string | number;
  /** current playback time (seconds) from your audio element */
  currentTime?: number;
  /** optional: when user clicks a line, seek player to its start time (seconds) */
  onSeek?: (t: number) => void;
};

const speakerStyle = (name: string) => {
  const s = (name ?? "").toLowerCase();
  if (s.includes("play")) return { bg: "blue.600", color: "white" };
  if (s.includes("color")) return { bg: "purple.600", color: "white" };
  if (s.includes("ref")) return { bg: "red.600", color: "white" };
  if (s.includes("host")) return { bg: "teal.600", color: "white" };
  return { bg: "gray.600", color: "white" };
};

/** "HH:MM:SS(.mmm)" -> seconds */
function timeToSeconds(t: string | undefined): number {
  if (!t) return 0;
  // Supports "MM:SS", "HH:MM:SS", and optional ".ms"
  const parts = t.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) {
    // MM:SS(.ms)
    const [mm, rest] = t.split(":");
    const [ss, ms] = rest.split(".");
    return parseInt(mm, 10) * 60 + parseInt(ss || "0", 10) + (ms ? Number(`0.${ms}`) : 0);
  }
  if (parts.length === 3) {
    const [hh, mmAndSs, maybeMs] = [parts[0], parts[1], parts[2]];
    const [hhStr, mmStr, ssStr] = t.split(":");
    const [ssWhole, ms] = ssStr.split(".");
    return (
      (parseInt(hhStr || "0", 10) * 3600) +
      (parseInt(mmStr || "0", 10) * 60) +
      parseInt(ssWhole || "0", 10) +
      (ms ? Number(`0.${ms}`) : 0)
    );
  }
  return 0;
}

export default function TranscriptTimeline({
  title = "Transcript",
  lines,
  h = 500,
  currentTime = 0,
  onSeek,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Precompute start times and the active index for the current time
  const { starts, activeIdx } = useMemo(() => {
    const starts = lines.map((l) => timeToSeconds(l.time));
    // active = the last line whose start <= currentTime
    let idx = -1;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= currentTime) idx = i;
      else break;
    }
    return { starts, activeIdx: idx };
  }, [lines, currentTime]);

  // Smooth-scroll the container to keep the active line in view (a bit above center)
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = itemRefs.current[activeIdx];
    const container = containerRef.current;
    if (!el || !container) return;

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const currentTop = container.scrollTop + (eRect.top - cRect.top);
    const targetTop = currentTop - cRect.height * 0.35; // place ~35% from top

    container.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [activeIdx]);

  const computedHeight = typeof h === "number" ? `${h}px` : h;
  const listHeight = `calc(${computedHeight} - 40px)`; // header space

  return (
    <Box
      bg="white"
      color="black"
      borderWidth="1px"
      borderColor="gray.300"
      borderRadius="12px"
      p="12px"
      boxShadow="md"
      fontFamily="Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      fontSize="14px"
      lineHeight="1.6"
      w="100%"
      h={h}
      overflow="hidden"
    >
      <Text fontWeight={700} mb={2}>
        {title}
      </Text>

      <Box
        ref={containerRef}
        as="div"
        overflowY="auto"
        pr={2}
        h={listHeight}
        // subtle sticky gradient edges for a “real app” feel
        position="relative"
        sx={{
          "&::before, &::after": {
            content: '""',
            position: "sticky",
            display: "block",
            left: 0,
            right: 0,
            height: "14px",
            zIndex: 1,
          },
          "&::before": {
            top: 0,
            background:
              "linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))",
          },
          "&::after": {
            bottom: 0,
            background:
              "linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))",
          },
        }}
      >
        <VStack spacing={2} align="stretch">
          {lines.map((line, idx) => {
            const badge = speakerStyle(line.speaker);
            const isActive = idx === activeIdx;
            const start = starts[idx] ?? 0;

            return (
              <HStack
                key={`${line.time}-${idx}`}
                ref={(el) => (itemRefs.current[idx] = el)}
                align="flex-start"
                spacing={3}
                p={2}
                borderRadius="10px"
                bg={isActive ? "orange.50" : idx % 2 ? "gray.50" : "white"}
                borderWidth={isActive ? "2px" : "1px"}
                borderColor={isActive ? "orange.300" : "gray.200"}
                boxShadow={isActive ? "0 6px 14px rgba(237, 137, 54, 0.25)" : "none"}
                transition="background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease"
                transform={isActive ? "translateY(-1px)" : "none"}
                cursor={onSeek ? "pointer" : "default"}
                onClick={() => onSeek?.(start)}
              >
                {/* timestamp chip */}
                <Box
                  as="span"
                  px="8px"
                  py="2px"
                  borderRadius="6px"
                  bg={isActive ? "yellow.200" : "yellow.100"}
                  borderWidth="1px"
                  borderColor={isActive ? "yellow.400" : "yellow.300"}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                  fontSize="12px"
                  letterSpacing="0.2px"
                >
                  {line.time}
                </Box>

                {/* speaker badge */}
                <Box
                  as="span"
                  px="8px"
                  py="2px"
                  borderRadius="6px"
                  bg={badge.bg}
                  color={badge.color}
                  fontWeight={700}
                  whiteSpace="nowrap"
                >
                  {line.speaker}
                </Box>

                {/* text */}
                <Text
                  flex="1"
                  wordBreak="break-word"
                  fontWeight={isActive ? 600 : 400}
                >
                  {line.text}
                </Text>
              </HStack>
            );
          })}
        </VStack>
      </Box>
    </Box>
  );
}
