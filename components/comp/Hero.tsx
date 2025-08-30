"use client";
import {
  Box,
  VStack,
  Text,
  HStack,
  Span,
  Link,
  IconButton,
} from "@chakra-ui/react";
import { Share, Upload } from "lucide-react";

function Hero() {
  return (
    <>
      <VStack
        mt="25px"
        justify="center"
        align="center"
        w="100%"
        textAlign="center"
        px={["4%", "4%", "6%", "6%", "6%", "10%"]}
      >


     
      </VStack>

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
                sx={{
                  caretColor: "black",
                  tabSize: 2,
                  whiteSpace: "pre",
                }}
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

        {/* Right: configuration & actions (unchanged from your improved version) */}
        <VStack
          justify="start"
          align="stretch"
          position="relative"
          h="100%"
          w={["95%", "95%", "95%", "600px", "600px", "600px"]}
          spacing="16px"
        >
          {/* Play-by-Play */}
          <Box
            position="relative"
            borderRadius="24px"
            
            overflow="hidden"
            p="20px"
          >
            <Text
              py="8px"
              fontSize={["20px", "24px", "24px"]}
              fontWeight={700}
              fontFamily="poppins"
              lineHeight="1.1"
              color="black"
            >
              Play-by-Play Commentator
            </Text>

            <HStack gap="10px" mt="10px" flexWrap="wrap">
              <Box
               cursor={"pointer"}
                as="button"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Play-by-play character name"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="40px"
                p="8px"
                px="12px"
                bg="white"
                fontFamily="poppins"
                color="black"
                _focus={{
                  outline: "none",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                Character 1
              </Box>
              <Box
               cursor={"pointer"}
                as="button"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Play-by-play character name"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="40px"
                p="8px"
                px="12px"
                bg="white"
                fontFamily="poppins"
                color="black"
                _focus={{
                  outline: "none",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                Character 2
              </Box>
            </HStack>

            <Box
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              Voice
              <Box
                as="select"
                mt="6px"
                w="100%"
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
            </Box>
          </Box>

          {/* Color Commentary */}
          <Box
            position="relative"
            borderRadius="24px"
            
            overflow="hidden"
            p="20px"
          >
            <Text
              py="8px"
              fontSize={["20px", "24px", "24px"]}
              fontWeight={700}
              fontFamily="poppins"
              lineHeight="1.1"
              color="black"
            >
              Choose Color Commentator
            </Text>

            <HStack gap="10px" mt="10px" flexWrap="wrap">
              <Box
              cursor={"pointer"}
                as="button"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Color commentator name"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="40px"
                p="8px"
                px="12px"
                bg="white"
                fontFamily="poppins"
                color="black"
                _focus={{
                  outline: "none",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
                

              >
                Analyst
              </Box>
              <Box
                   cursor={"pointer"}
             as="button"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Color commentator name"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="40px"
                p="8px"
                px="12px"
                bg="white"
                fontFamily="poppins"
                color="black"
                _focus={{
                  outline: "none",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
                }}
              >
                Sideline
              </Box>
            </HStack>

            <Box
              mt="14px"
              as="label"
              display="block"
              textAlign="left"
              color="black"
              fontWeight={600}
              fontSize="14px"
            >
              Tone
              <Box
                as="select"
                mt="6px"
                w="100%"
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
            </Box>
          </Box>

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
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(1px)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(0)";
            }}
          >
            <HStack gap="10px" justify="center">
              <Text
                fontSize={["18px", "18px", "20px"]}
                lineHeight="1.1"
                color="white"
              >
                Generate
              </Text>
            </HStack>
          </Box>
        </VStack>
      </HStack>

      <VStack w={["100%", "100%", "100%", "100%", "100%", "100%"]}  px={["4%", "4%", "6%", "6%", "6%", "10%"]}>
        <HStack justify={"center"} align="start" w="100%" flexWrap={[ "wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]} >
          <Box
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
            w="1000px"
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


         <HStack justify={"center"} align="center" w={["100%", "100%", "100%", "1000px", "1000px", "1000px"]}   flexWrap={[ "wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}   >
          <Box
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
           h="500px"
            w="100%"
            boxShadow="md"
                 fontWeight={500}
                   fontFamily={"poppins"}
          >
            Commentator 1: "Play-by-Play"
               <Box mt="20px" textAlign="start"> 
Hi
          </Box>
          </Box>
                 <Box
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
            h="500px"
            w="100%"
            boxShadow="md"
            fontWeight={500}
            fontFamily={"poppins"}
          >  Commentator 2: "Color"


             <Box mt="20px" textAlign="start"> 
Hi
          </Box>
          </Box>
          
       
          </HStack>
      </VStack>
    </>
  );
}

export default Hero;
