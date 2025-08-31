"use client";
import React, { useRef, useState } from "react";
import { Box, VStack, Text, HStack } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { parseTranscriptJSON } from "@/lib/parseTranscript";
import { publishAudioUrl } from "@/lib/audioBus";

const InputBoxes = () => {
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
      const lines = parseTranscriptJSON(raw);

      setSpeaking(true);

      const res = await fetch("/api/playai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }), // you can also send custom voices/seed here
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "TTS request failed");
      }

      const data = await res.json();
      const url = data?.audio?.url as string | undefined;
      if (!url) throw new Error("No audio URL returned");

      // Tell the audio player to load + play
      publishAudioUrl(url);
    } catch (e: any) {
      console.error(e);
      alert(`Couldn't generate audio:\n${e?.message ?? String(e)}`);
    } finally {
      setSpeaking(false);
    }
  };
  const optionSet = [
    { label: "Neutral", value: "neutral" },
    { label: "Energetic", value: "energetic" },
    { label: "Calm", value: "calm" },
  ];

  const modelOptions = [
    { label: "GPT-3.5", value: "gpt-3.5" },
    { label: "GPT-4", value: "gpt-4" },
    { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
  ];

  const sections = [
    { title: "Choose Model", fields: ["Model"], options: modelOptions },
    {
      title: "Choose Play Commentator",
      fields: ["Character", "Voice"],
      options: optionSet,
    },
    {
      title: "Choose Color Commentator",
      fields: ["Character", "Voice"],
      options: optionSet,
    },
  ];

  const SelectField = ({
    label,
    id,
    options,
  }: {
    label: string;
    id: string;
    options: { label: string; value: string }[];
  }) => (
    <HStack
      mt="14px"
      textAlign="left"
      color="black"
      fontWeight={600}
      fontSize="14px"
      gap="10px"
      align="center"
    >
      <Box as="label" htmlFor={id} minW="96px">
        {label}
      </Box>

      {/* Wrapper so we can position the dropdown icon */}
      <Box position="relative" w="250px">
        <Box
          as="select"
          id={id}
          name={id}
          mt="6px"
          w="100%"
          borderWidth="1px"
          borderColor="gray.300"
          borderRadius="12px"
          p="10px"
          pr="32px" // 👈 give padding-right so text doesn’t overlap icon
          bg="white"
          color="black"
          fontWeight={300}
          appearance="none" // 👈 hides the default native arrow
          _focus={{
            borderColor: "black",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.08)",
          }}
          _hover={{ borderColor: "gray.400" }}
        >
          {options.map((opt) => (
            <Box key={opt.value} as="option" value={opt.value}>
              {opt.label}
            </Box>
          ))}
        </Box>

        {/* Custom dropdown icon (▼) */}
        <Box
          position="absolute"
          right="20px"
          top="50%"
          transform="translateY(-50%)"
          pointerEvents="none"
          color="gray.500"
          fontSize="14px"
        >
          <ChevronDown />
        </Box>
      </Box>
    </HStack>
  );

  return (
    <>
      <VStack 
        justify={["center", "center", "space-between", "space-between", "space-between", "space-between"]}
        align="stretch"
        position="relative"
        h="100%"
        w="100%"
                py="10px"
      >
        {sections.map((section, i) => (
          <Box key={section.title + i}>
            <Text
                fontFamily="poppins"
                fontWeight={600}
                color="black"
                fontSize="20px"
            >
              {section.title}
            </Text>

            {section.fields.map((label, idx) => {
              const id = `section-${i}-field-${idx}`;
              return (
                <SelectField
                  key={id}
                  id={id}
                  label={label}
                  options={section.options}
                />
              );
            })}
          </Box>
        ))}

        {/* Generate */}
        <Box
        mt="15px"
        as="button"
        w="360px"
        borderRadius="16px"
        bg={speaking ? "gray.500" : "orange.400"}
        color="white"
        p="16px"
        textAlign="center"
        _hover={{ bg: speaking ? "gray.500" : "gray.800" }}
        _active={{ bg: speaking ? "gray.500" : "gray.900" }}
        fontFamily="poppins"
        fontWeight={700}
        cursor={speaking ? "not-allowed" : "pointer"}
        aria-disabled={speaking}
        onClick={handleGenerate}
        disabled={speaking}
      >
        <HStack gap="10px" justify="center">
          <Text fontSize={["18px", "18px", "20px"]} lineHeight="1.1">
            {speaking ? "Generating…" : "Generate"}
          </Text>
        </HStack>
      </Box>

        <textarea ref={textareaRef} style={{ display: "none" }} />
      </VStack>
    </>
  );
};

export default InputBoxes;
