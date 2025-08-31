"use client";
import {
  Box,
  VStack,
  Text,
  HStack,
  Span,
  Button,
  FileUpload,
} from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { HiUpload } from "react-icons/hi";

import InputBoxes from "./InputBoxes";
import AudioData from "./AudioData";

function Hero() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <>
      <HStack
        px={["4%", "4%", "6%", "8%", "16%", "16%"]}
        mt="30px"
        mb="50px"
        justifyContent="center"
        alignItems="start"
        w={["100%", "100%", "100%", "100%", "100%", "100%"]}
        h={"100%"}
        flexWrap={["wrap", "wrap", "nowrap", "nowrap", "nowrap", "nowrap"]}
        gap={["80px", "80px", "80px", "80px", "80px", "80px"]}
      >
        {/* Left: JSON input panel */}
        <Box
          h={["100%", "100%", "100%", "100%", "100%", "100%"]}
          w={["100%", "100%", "100%", "100%", "100%", "100%"]}
          overflow="hidden"
          display="flex"
          justifyContent="center"
        >
          <Box h="100%" w="100%" overflow="hidden">
            {/* Header strip */}
            <HStack w="100%" justify="space-between" align="center">
              <Box w={"100%"}>
                <Text
                  fontFamily="poppins"
                  fontWeight={600}
                  color="black"
                  fontSize="20px"
                >
                  Game Data
                </Text>
              </Box>

              <FileUpload.Root directory>
                <FileUpload.HiddenInput />
                <FileUpload.Trigger asChild>
                  <HStack justify="end" w="100%" align="end">
                    <Button
                      size="sm"
                      bg="white" // 👈 grey background
                      color="black" // 👈 text color
                      border="1px solid"
                      borderRadius={"8px"}
                      borderColor="gray.400"
                      _hover={{ bg: "gray.300" }}
                      _active={{ bg: "gray.400" }}
                      fontFamily="poppins"
                      fontWeight={600}
                      fontSize="14px"
                    >
                      <HiUpload /> Upload file
                    </Button>
                  </HStack>
                </FileUpload.Trigger>
                <FileUpload.List />
              </FileUpload.Root>
            </HStack>

            {/* Editor */}
            <Box py={"10px"} w={"100%"} h={"480px"} borderRadius={"24px"}>
              <Box
                borderRadius={"24px"}
                as="textarea"
                ref={textareaRef}
                aria-label="Paste JSON with timestamps"
                placeholder={`[
  { "time": "00:00:03.250", "speaker": "PlayByPlay", "text": "Tip-off won by the Tigers." },
  { "time": "00:00:07.900", "speaker": "Color", "text": "Great vertical from Okafor there." }
]`}
                spellCheck={false}
                wrap="off"
                resize="none"
                fontFamily="mono"
                fontSize="13px"
                lineHeight="1.6"
                bg="black"
                color="gray.400" // <-- changed here
                border={"1px solid #ccc"}
                p="12px"
                h={"100%"}
                w="100%"
                overflow="auto"
                sx={{
                  caretColor: "gray",
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

        <InputBoxes />
      </HStack>

      <AudioData />
    </>
  );
}

export default Hero;
