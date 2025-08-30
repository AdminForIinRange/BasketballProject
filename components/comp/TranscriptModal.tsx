"use client";
import { Box, VStack, Text, HStack, Span } from "@chakra-ui/react";

type Line = {
  time: string;
  speaker: string;
  text: string;
};

type Props = {
  title?: string;
  lines: Line[];
  h?: string | number;
};

const speakerStyle = (name: string) => {
  const s = name.toLowerCase();
  if (s.includes("play")) return { bg: "blue.600", color: "white" };
  if (s.includes("color")) return { bg: "purple.600", color: "white" };
  if (s.includes("ref")) return { bg: "red.600", color: "white" };
  if (s.includes("host")) return { bg: "teal.600", color: "white" };
  return { bg: "gray.600", color: "white" };
};

export default function TranscriptPanel({ title = "Transcript", lines, h = 500 }: Props) {
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
      <Text fontWeight={700} mb={2}>{title}</Text>

      <Box
        as="div"
        overflowY="auto"
        pr={2}
        h={`calc(${typeof h === "number" ? `${h}px` : h} - 40px)`}
      >
        <VStack spacing={2} align="stretch">
          {lines.map((line, idx) => {
            const badge = speakerStyle(line.speaker);
            return (
              <HStack
                key={`${line.time}-${idx}`}
                align="flex-start"
                spacing={3}
                bg={idx % 2 ? "gray.50" : "white"}
                p={2}
                borderRadius="8px"
              >
                {/* timestamp chip */}
                <Box
                  as="span"
                  px="8px"
                  py="2px"
                  borderRadius="6px"
                  bg="yellow.100"
                  borderWidth="1px"
                  borderColor="yellow.300"
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
                  fontWeight={600}
                  whiteSpace="nowrap"
                >
                  {line.speaker}
                </Box>

                {/* text */}
                <Text flex="1" wordBreak="break-word">
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
