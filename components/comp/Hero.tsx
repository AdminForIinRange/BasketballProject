"use client";
import { Box, VStack, Text, HStack, Span, Link } from "@chakra-ui/react";

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
        <Text
          fontSize={["16px", "18px", "24px"]}
          fontFamily="poppins"
          fontWeight={700}
          lineHeight="1.6"
          color="black"
        >
          Efficient, time- and cost-effective text-to-speech solutions
        </Text>

        <Text
          fontSize={["32px", "40px", "48px"]}
          fontWeight={700}
          fontFamily="poppins"
          lineHeight="1.1"
          color="black"
          px={["5%", "5%", "0", "10%", "10%", "10%"]}
          mt="6px"
        >
          Generate quality audio for basketball commentary
        </Text>

        <Box
          my="25px"
          w={["100%", "100%", "100%", "640px", "640px", "640px"]}
          borderWidth="1px"
          borderColor="gray.300"
        />
      </VStack>

      <HStack
        px={["4%", "4%", "6%", "6%", "6%", "10%"]}
        mt="10px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        w="100%"
        spacing={["16px", "16px", "20px", "24px", "24px", "32px"]}
      >
        {/* Left: input panel */}
        <Box
          position="relative"
          h={["340px", "360px", "380px", "500px", "520px", "560px"]}
          w={["95%", "95%", "95%", "600px", "600px", "600px"]}
          borderRadius="24px"
          bgPos="center"
          bgSize="cover"
          overflow="hidden"
          display="flex"
          justifyContent="end"
        >
          <Box
            position="relative"
            h="100%"
            w="100%"
            borderRadius="24px"
            bg="gray.100"
            overflow="hidden"
            p="20px"
          >
            <Text
              fontFamily="poppins"
              textAlign="start"
              fontWeight={600}
              color="black"
            >
              Commentary Script
            </Text>

            <Box
              as="textarea"
              placeholder="Type your basketball commentary here…"
              resize="none"
              _placeholder={{ color: "gray.500" }}
              flex="1"
              fontSize="14px"
              outline="none"
              mt="10px"
              h="calc(100% - 44px)"
              w="100%"
              bg="white"
              color="black"
              borderWidth="1px"
              borderColor="gray.300"
              borderRadius="12px"
              p="12px"
              _focus={{ borderColor: "black", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
            />
          </Box>
        </Box>

        {/* Right: configuration & actions */}
        <VStack
          justify="start"
          align="stretch"
          position="relative"
          h="100%"
          w={["95%", "95%", "95%", "600px", "600px", "600px"]}
          spacing="16px"
        >
          {/* Play-by-play */}
          <Box
            position="relative"
            borderRadius="24px"
            bg="gray.100"
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
              Play-by-Play Commentary
            </Text>

            <HStack
              gap="10px"
              px="0"
              mt="10px"
              flexWrap="wrap"
            >
              {/* Editable character chips (rename in place) */}
              <Box
                as="span"
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
                _focus={{ outline: "none", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
              >
                Character 1
              </Box>

              <Box
                as="span"
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
                _focus={{ outline: "none", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
              >
                Character 2
              </Box>
            </HStack>

            {/* Voice select (native) */}
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
                _focus={{ borderColor: "black", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
              >
                <Box as="option" value="neutral">Neutral</Box>
                <Box as="option" value="energetic">Energetic</Box>
                <Box as="option" value="calm">Calm</Box>
              </Box>
            </Box>
          </Box>

          {/* Color commentary */}
          <Box
            position="relative"
            borderRadius="24px"
            bg="gray.100"
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
              Choose Color Commentary
            </Text>

            <HStack
              gap="10px"
              px="0"
              mt="10px"
              flexWrap="wrap"
            >
              <Box
                as="span"
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
                _focus={{ outline: "none", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
              >
                Analyst
              </Box>
              <Box
                as="span"
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
                _focus={{ outline: "none", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
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
                _focus={{ borderColor: "black", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
              >
                <Box as="option" value="insightful">Insightful</Box>
                <Box as="option" value="humorous">Humorous</Box>
                <Box as="option" value="dramatic">Dramatic</Box>
              </Box>
            </Box>
          </Box>

          {/* Generate button */}
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
            onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(1px)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
          >
            <HStack gap="10px" p="0" justify="center">
              <Text
                fontSize={["18px", "18px", "20px"]}
                textAlign="center"
                w="100%"
                lineHeight="1.1"
                color="white"
              >
                Generate
              </Text>
            </HStack>
          </Box>
        </VStack>
      </HStack>
    </>
  );
}

export default Hero;
