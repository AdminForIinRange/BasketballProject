"use client";
import { Box, VStack, Text } from "@chakra-ui/react";

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
      w="70%"
      h={h}
      overflow="hidden"
    >
      <Text fontWeight={700} mb={2}>{title}</Text>

      <Box
        as="pre"
        overflowY="auto"
        pr={2}
        h={`calc(${typeof h === "number" ? `${h}px` : h} - 40px)`}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
        fontSize="12px"
        whiteSpace="pre-wrap"
      >
        {JSON.stringify(lines, null, 2)}
      </Box>
    </Box>
  );
}
