"use client";
import { Box, VStack, Text, HStack, Button, Textarea } from "@chakra-ui/react";
import { HiUpload } from "react-icons/hi";
import { useMemo, useRef, useState } from "react";

import InputBoxes from "./InputBoxes";
import AudioData from "./AudioData";
import AudioOverlap from "./AuidoOverlap"; // ✅ fixed name
import TranscriptJsonPanel from "./TranscriptJsonPanel";
// We still use the shared timeline component INSIDE AudioOverlap now
// import TranscriptTimeline from "./TranscriptTimeline";
import { parseTranscriptJSON } from "@/lib/parseTranscript";
import TranscriptTimeline from "./TranscriptTimeline";
import TranscriptTimelineBoth from "./TranscriptTimelineBoth";

type Line = { time?: string; speaker?: string; text: string };

function splitBySpeaker(lines: Line[]) {
  const color: Line[] = [];
  const play: Line[] = [];
  for (const l of lines) {
    const s = (l.speaker || "").toLowerCase();
    if (s.includes("color")) color.push(l);
    else if (s.includes("play")) play.push(l);
    else play.push(l); // default route
  }
  return { color, play };
}

export default function Hero() {
  const [transcript, setTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileLoad: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text().catch(() => "");
    setTranscript(text || "");
  };

  // Parse & split (memoized)
  const { parsedLines, colorLines, playLines } = useMemo(() => {
    try {
      const parsed = transcript.trim() ? parseTranscriptJSON(transcript) : [];
      const { color, play } = splitBySpeaker(parsed);
      return { parsedLines: parsed, colorLines: color, playLines: play };
    } catch {
      return { parsedLines: [], colorLines: [], playLines: [] };
    }
  }, [transcript]);

  return (
    <>
      <HStack
        px={["4%", "4%", "6%", "8%", "16%", "16%"]}
        mt="30px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        w="100%"
        h="100%"
        flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
        gap={["16px", "16px", "20px", "80px", "80px", "80px"]}
      >
        {/* Left: JSON input panel */}
        <Box w="100%" overflow="hidden" display="flex" justifyContent="center">
          <Box w="100%" overflow="hidden">
            {/* Header strip */}
            <HStack w="100%" justify="space-between" align="center">
              <Box w="100%">
                <Text
                  fontFamily="poppins"
                  fontWeight={600}
                  color="black"
                  fontSize="20px"
                >
                  Game Data
                </Text>
              </Box>

              {/* file upload */}
              <HStack justify="end" w="100%" align="end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFileLoad}
                  style={{ display: "none" }}
                />
                <Button
                  size="sm"
                  bg="white"
                  color="black"
                  border="1px solid"
                  borderRadius="8px"
                  borderColor="gray.400"
                  _hover={{ bg: "gray.300" }}
                  _active={{ bg: "gray.400" }}
                  onClick={handleFilePick}
                  leftIcon={<HiUpload />}
                >
                  Upload file
                </Button>
              </HStack>
            </HStack>

            {/* Editor */}
            <Box py="10px" h="480px" borderRadius="24px">
              <Textarea
                borderRadius="24px"
                aria-label="Paste JSON with timestamps"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={`[
  { "time": "00:00:03.250", "speaker": "PlayByPlay", "text": "Tip-off won by the Tigers." },
  { "time": "00:00:07.900", "speaker": "Color", "text": "Great vertical from Okafor there." }
]`}
                spellCheck={false}
                resize="none"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                fontSize="13px"
                lineHeight="1.6"
                bg="gray.900"
                color="white"
                border="1px solid #ccc"
                p="12px"
                h="100%"
                w="100%"
                _placeholder={{ color: "gray.500" }}
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                  outline: "none",
                }}
                
              />
            </Box>
          </Box>
        </Box>

        {/* Right controls */}
        <InputBoxes transcript={transcript} />
      </HStack>

      {/* Dual player with synced timelines */}

      <AudioOverlap colorLines={colorLines} playLines={playLines} />
      <AudioData />
      {/* Raw JSON preview */}
      <VStack mt="50px" w="full" px={["4%", "4%", "6%", "8%", "16%", "16%"]}>
        <HStack
          justify="center"
          align="stretch"
          w="100%"
          flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
          spacing={4}
        >
        


        </HStack>
      </VStack>

      {/* If you still want the single player somewhere: */}
      {/* <AudioData /> */}
    </>
  );
}
