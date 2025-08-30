"use client";
import {
  Box,
  VStack,
  Text,
  HStack,
  Span,
} from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

type TranscriptItem = {
  time?: string;   // optional "HH:MM:SS.mmm"
  speaker?: string;
  text: string;
};

async function speakOnce(text: string) {
  const res = await fetch('/api/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.startsWith('audio/')) {
    throw new Error(await res.text());
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parseTranscriptJSON(raw: string): TranscriptItem[] {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("JSON must be an array.");
  const items: TranscriptItem[] = [];
  for (const [idx, row] of data.entries()) {
    if (!row || typeof row !== 'object') {
      throw new Error(`Item ${idx + 1} is not an object.`);
    }
    const text = row.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error(`Item ${idx + 1} missing non-empty "text".`);
    }
    items.push({
      text: text.trim(),
      time: typeof row.time === 'string' ? row.time : undefined,
      speaker: typeof row.speaker === 'string' ? row.speaker : undefined,
    });
  }
  return items;
}

function Hero() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const handleGenerate = async () => {
    if (speaking) return;
    try {
      const raw = textareaRef.current?.value ?? "";
      if (!raw.trim()) {
        alert("Paste a JSON transcript first.");
        return;
      }
      const items = parseTranscriptJSON(raw);

      setSpeaking(true);
      // Speak each line sequentially
      for (const item of items) {
        await speakOnce(item.text);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Couldn't play transcript:\n${e?.message ?? String(e)}`);
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <>
      <VStack
        mt="25px"
        justify="center"
        align="center"
        w="100%"
        textAlign="center"
        px={["4%", "4%", "6%", "6%", "6%", "10%"]}
      />

      <HStack
        px={["4%", "4%", "6%", "6%", "6%", "10%"]}
        mt="10px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        w="100%"
        spacing={["16px", "16px", "20px", "24px", "24px", "32px"]}
        flexWrap={[ "wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]} 
        gap={["16px", "16px", "20px", "24px", "24px", "32px"]}
      >
        {/* Left: JSON input panel */}
        <Box
          position="relative"
          h={["340px", "360px", "380px", "500px", "520px", "560px"]}
          w={["95%", "95%", "95%", "600px", "600px", "600px"]}
          borderRadius="24px"
          overflow="hidden"
          display="flex"
          justifyContent="end"
        >
          <Box
            position="relative"
            h="100%"
            w="100%"
            borderRadius="24px"
            overflow="hidden"
          >
            {/* Header strip */}
            <HStack
              as="header"
              w="100%"
              justify="space-between"
              align="center"
              px="16px"
              py="10px"
              borderBottomWidth="1px"
              borderColor="gray.300"
              bg="white"
            >
              <Text
                fontFamily="poppins"
                fontWeight={600}
                color="black"
                fontSize="14px"
              >
                JSON mode · timestamps supported
              </Text>
              <Text fontFamily="poppins" color="gray.600" fontSize="12px">
                Example keys:{" "}
                <Span as="span" color="black">
                  time, speaker, text
                </Span>
              </Text>
            </HStack>

            {/* Editor */}
            <Box p="16px" h="100%">
              <Box
                as="textarea"
                ref={textareaRef}
                aria-label="Paste JSON with timestamps"
                placeholder={`[
  {
    "time": "00:00:03.250",
    "speaker": "PlayByPlay",
    "text": "Tip-off won by the Tigers."
  },
  {
    "time": "00:00:07.900",
    "speaker": "Color",
    "text": "Great vertical from Okafor there."
  }
]`}
                spellCheck={false}
                wrap="off"
                resize="none"
                fontFamily="mono"
                fontSize="13px"
                lineHeight="1.6"
                bg="white"
                color="black"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="12px"
                h="100%"
                w="100%"
                overflow="auto"
                sx={{ caretColor: "black", tabSize: 2, whiteSpace: "pre" }}
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

        {/* Right: configuration & actions (trimmed for brevity) */}
        <VStack
          justify="start"
          align="stretch"
          position="relative"
          h="100%"
          w={["95%", "95%", "95%", "600px", "600px", "600px"]}
          spacing="16px"
        >
          {/* … your existing character/tone UI … */}

          {/* Generate */}
          <Box
            as="button"
            borderRadius="16px"
            bg="black"
            color="white"
            p="16px"
            textAlign="center"
            _hover={{ bg: "gray.800" }}
            _active={{ bg: "gray.900" }}
            transition="background-color 0.2s ease, transform 0.05s ease"
            fontFamily="poppins"
            fontWeight={700}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            }}
            onClick={handleGenerate}
            disabled={speaking}
          >
            <HStack gap="10px" justify="center">
              <Text fontSize={["18px", "18px", "20px"]} lineHeight="1.1" color="white">
                {speaking ? "Speaking…" : "Generate"}
              </Text>
            </HStack>
          </Box>
        </VStack>
      </HStack>

      {/* … the rest of your player UI untouched … */}
    </>
  );
}

export default Hero;
