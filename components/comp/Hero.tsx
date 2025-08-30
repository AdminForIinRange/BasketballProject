"use client";
import { Box, VStack, Text, HStack, Span } from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import TranscriptPanel from "./TranscriptModal";
import TranscriptJsonPanel from "./TranscriptJsonPanel";

type TranscriptItem = {
  time?: string; // optional "HH:MM:SS.mmm"
  speaker?: string;
  text: string;
};

async function speakOnce(text: string) {
  const res = await fetch("/api/elevenlabs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.startsWith("audio/")) {
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
    if (!row || typeof row !== "object") {
      throw new Error(`Item ${idx + 1} is not an object.`);
    }
    const text = row.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`Item ${idx + 1} missing non-empty "text".`);
    }
    items.push({
      text: text.trim(),
      time: typeof row.time === "string" ? row.time : undefined,
      speaker: typeof row.speaker === "string" ? row.speaker : undefined,
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
      <HStack
        px={["4%", "4%", "6%", "6%", "6%", "16%"]}
        mt="10px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        h={"100%"}
        spacing={["16px", "16px", "20px", "24px", "24px", "32px"]}
        flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
        gap={["16px", "16px", "20px", "50px", "50px", "50px"]}
      >
        {/* Left: JSON input panel */}
        <Box
          position="relative"
          h={["340px", "360px", "380px", "500px", "520px", "560px"]}
          w={["100%%", "100%%", "100%%", "100%", "100%", "100%"]}
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
              py="10px"
              bg="white"
            >
              <Text
                fontFamily="poppins"
                fontWeight={600}
                color="black"
                fontSize="20px"
              >
                Game Data
              </Text>

              {/* <Box
                    fontFamily="poppins"
            
                color="black"
                fontSize="14px"
                as="select"
          
                w="fit-content"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="8px"
                px={"12px"}
                bg="white"
             
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                <Box as="option" value="neutral">
                  Hugging Face
                </Box>
                <Box as="option" value="energetic">
                  Eeleven labs
                </Box>
                <Box as="option" value="calm">
                  Other
                </Box>
              </Box>
               */}
            </HStack>

            {/* Editor */}
            <Box py={"10px"} h={"500px"}>
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
                bg="black"
                color="black"
                border={" 1px solid #ccc"}
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

        {/* Right: configuration & actions (unchanged from your improved version) */}
        <VStack
          justify="space-between"
          align="stretch"
          position="relative"
          h={"100%"}
          w={["100%%", "100%%", "100%%", "100%", "100%", "100%"]}
        >
          {/* Play-by-Play */}
          <Box>
            <Text
              py="8px"
              fontSize={["20PX", "20PX", "20PX"]}
              fontWeight={700}
              fontFamily="poppins"
              lineHeight="1.1"
              color="black"
            >
              Choose Play Commentator
            </Text>

            <HStack gap="10px" mt="10px" flexWrap="wrap"></HStack>

            <VStack
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              <Box>Character</Box>

              <Box
                as="select"
                mt="6px"
                w="300px"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="10px"
                bg="white"
                color="black"
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                <Box as="option" value="neutral">
                  Neutral
                </Box>
                <Box as="option" value="energetic">
                  Energetic
                </Box>
                <Box as="option" value="calm">
                  Calm
                </Box>
              </Box>
            </VStack>

            <VStack
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              <Box>Voice</Box>

              <Box
                as="select"
                mt="6px"
              w="300px"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="10px"
                bg="white"
                color="black"
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                <Box as="option" value="neutral">
                  Neutral
                </Box>
                <Box as="option" value="energetic">
                  Energetic
                </Box>
                <Box as="option" value="calm">
                  Calm
                </Box>
              </Box>
            </VStack>
          </Box>

          {/* Color Commentary */}
          <Box
            position="relative"
            borderRadius="24px"
            overflow="hidden"
            py="20px"
          >
            <Text
              py="8px"
              fontSize={["20px", "20px", "20px"]}
              fontWeight={700}
              fontFamily="poppins"
              lineHeight="1.1"
              color="black"
            >
              Choose Color Commentator
            </Text>

            

 <VStack
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              <Box>Character</Box>

              <Box
                as="select"
                mt="6px"
                w="300px"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="10px"
                bg="white"
                color="black"
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                <Box as="option" value="neutral">
                  Neutral
                </Box>
                <Box as="option" value="energetic">
                  Energetic
                </Box>
                <Box as="option" value="calm">
                  Calm
                </Box>
              </Box>
            </VStack>


            <VStack
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              <Box>Voice</Box>

              <Box
                as="select"
                mt="6px"
                w="300px"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="12px"
                p="10px"
                bg="white"
                color="black"
                _focus={{
                  borderColor: "black",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                <Box as="option" value="insightful">
                  Insightful
                </Box>
                <Box as="option" value="humorous">
                  Humorous
                </Box>
                <Box as="option" value="dramatic">
                  Dramatic
                </Box>
              </Box>
            </VStack>
          </Box>

          {/* Generate */}
          <Box
            w={"300px"}
            as="button"
            borderRadius="16px"
            bg="orange.400"
            color="white"
            p="16px"
            textAlign="center"
            _hover={{ bg: "gray.800" }}
            _active={{ bg: "gray.900" }}
            transition="background-color 0.2s ease, transform 0.05s ease"
            fontFamily="poppins"
            fontWeight={700}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(0)";
            }}
            onClick={handleGenerate}
            disabled={speaking}
          >
            <HStack gap="10px" justify="center">
              <Text
                fontSize={["18px", "18px", "20px"]}
                lineHeight="1.1"
                color="white"
              >
                {speaking ? "Speaking…" : "Generate"}
              </Text>
            </HStack>
          </Box>
        </VStack>
      </HStack>

      <VStack
        w={["100%", "100%", "100%", "100%", "100%", "100%"]}
        px={["4%", "4%", "6%", "6%", "6%", "16%"]}
      >
        <HStack
          justify={"center"}
          align="start"
          w="100%"
          flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
        >
          <Box
            mb={"50px"}
            spellCheck={false}
            wrap="off"
            resize="none"
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
            boxShadow="md"
          >
            {/* PLAYER BODY */}
            <HStack align="stretch" spacing={4} w="100%">
              {/* PLAY BUTTON */}
              <Box
                as="button"
                w="72px"
                minW="72px"
                h="110px"
                borderRadius="10px"
                borderWidth="1px"
                borderColor="gray.300"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="gray.50"
                _hover={{ bg: "gray.200" }}
              >
                <Text fontSize="24px">▶</Text>
              </Box>

              {/* RIGHT SIDE: TITLE + WAVEFORM + CONTROLS */}

              <VStack align="start" spacing={3} w="100%">
                {/* TITLE */}

                {/* WAVEFORM (spiky bars like SoundCloud) */}
                {(() => {
                  const progress = 38; // % played — wire this to your audio time
                  const count = 170; // number of bars
                  // generate pleasant, uneven peaks
                  const bars = Array.from({ length: count }, (_, i) => {
                    const t = i / count;
                    const env = Math.sin(Math.PI * t); // fade in/out envelope
                    const ripple =
                      Math.sin(i * 0.55) * 0.35 +
                      Math.sin(i * 0.13) * 0.2 +
                      Math.sin(i * 0.03) * 0.1;
                    const h = Math.max(0.08, env * (0.55 + ripple)); // 0..~1
                    return Math.round(h * 70) + 10; // px height
                  });

                  const BarRow = ({ color }: { color: string }) => (
                    <HStack
                      spacing="3px"
                      align="end"
                      position="absolute"
                      top="50%"
                      transform="translateY(-50%)"
                      pl="4px"
                      pr="4px"
                    >
                      {bars.map((h, i) => (
                        <Box
                          key={`${color}-${i}`}
                          w="3px"
                          h={`${h}px`}
                          bg={color}
                          borderRadius="2px"
                        />
                      ))}
                    </HStack>
                  );

                  return (
                    <Box
                      position="relative"
                      w="100%"
                      h="110px"
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="8px"
                      bg="gray.50"
                      overflow="hidden"
                    >
                      {/* Base (unplayed) bars */}
                      <BarRow color="orange.200" />
                      {/* Played overlay */}
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        h="100%"
                        w={`${progress}%`}
                        overflow="hidden"
                      >
                        <BarRow color="orange.400" />
                      </Box>
                    </Box>
                  );
                })()}

                {/* CONTROLS ROW */}
                <HStack justify="space-between" align="center" w="100%">
                  {/* Volume */}

                  {/* Timecode */}
                  <Text fontSize="12px" color="gray.600">
                    00:00 / 04:04
                  </Text>

                  {/* Upload and Share */}
                  <HStack spacing="2" align="center">
                    <Upload size={20} />
                  </HStack>
                </HStack>
              </VStack>
            </HStack>
          </Box>
        </HStack>

        <VStack w="full" spacing={6}>
          <HStack
            justify="center"
            align="stretch"
            w={["100%", "100%", "100%", "1000px", "1000px", "100%"]}
            flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
            spacing={4}
          >
            <TranscriptJsonPanel title="Transcript A" lines={sample} h={500} />
            <TranscriptPanel title="Transcript B" lines={sample} h={500} />
          </HStack>
        </VStack>
      </VStack>

      {/* … your existing character/tone UI … */}

      {/* Generate */}

      {/* … the rest of your player UI untouched … */}
    </>
  );
}

export default Hero;
