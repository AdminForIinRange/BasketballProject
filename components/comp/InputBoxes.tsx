"use client";
import React, { useState } from "react";
import { Box, VStack, Text, HStack } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { parseTranscriptJSON } from "@/lib/parseTranscript";

import { publishAudioUrl, publishDualAudioUrls } from "@/lib/audioBus";

type Props = { transcript: string };   // <-- accept the editor text

export default function InputBoxes({ transcript }: Props) {
  const [speaking, setSpeaking] = useState(false);

const handleGenerateDual = async () => {
  if (speaking) return;
  try {
    const raw = transcript ?? "";
    if (!raw.trim()) {
      alert("Paste a JSON transcript first.");
      return;
    }
    const lines = parseTranscriptJSON(raw);

    // split by speaker
    const color: typeof lines = [];
    const play: typeof lines  = [];
    for (const l of lines) {
      const s = (l.speaker || "").toLowerCase();
      if (s.includes("color")) color.push(l);
      else if (s.includes("play")) play.push(l);
      else play.push(l); // default route
    }
    if (!color.length && !play.length) {
      alert("No lines found after split.");
      return;
    }

    setSpeaking(true);

    const body = (arr: typeof lines) => JSON.stringify({ lines: arr });
    const [resColor, resPlay] = await Promise.all([
      color.length ? fetch("/api/playai", { method: "POST", headers: { "Content-Type": "application/json" }, body: body(color) }) : Promise.resolve(null),
      play.length  ? fetch("/api/playai", { method: "POST", headers: { "Content-Type": "application/json" }, body: body(play)  }) : Promise.resolve(null),
    ]);

    const pickUrl = async (res: Response | null) => {
      if (!res) return null;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "TTS request failed");
      }
      const data = await res.json();
      return (data?.audio?.url as string) ?? null;
    };

    const [colorUrl, playUrl] = await Promise.all([pickUrl(resColor), pickUrl(resPlay)]);
    publishDualAudioUrls(playUrl, colorUrl); // 👈 tell AudioOverlap to load both
  } catch (e: any) {
    console.error(e);
    alert(`Couldn't generate dual audio:\n${e?.message ?? String(e)}`);
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
    { label: "PlayAi", value: "playAi" },
  
  ];
  const sections = [
    { title: "Choose Model", fields: ["Model"], options: modelOptions },
    { title: "Choose Play Commentator", fields: ["Character", "Voice"], options: optionSet },
    { title: "Choose Color Commentator", fields: ["Character", "Voice"], options: optionSet },
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
    <HStack mt="14px" color="black" fontWeight={600} fontSize="14px" gap="10px" align="center">
      <Box as="label" htmlFor={id} minW="96px">
        {label}
      </Box>
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
          pr="32px"
          bg="white"
          color="black"
          fontWeight={300}
          appearance="none"
          _focus={{ borderColor: "black", boxShadow: "0 0 0 2px rgba(0,0,0,0.08)" }}
          _hover={{ borderColor: "gray.400" }}
        >
          {options.map((opt) => (
            <Box key={opt.value} as="option" value={opt.value}>
              {opt.label}
            </Box>
          ))}
        </Box>
        <Box position="absolute" right="20px" top="50%" transform="translateY(-50%)" pointerEvents="none" color="gray.500" fontSize="14px">
          <ChevronDown />
        </Box>
      </Box>
    </HStack>
  );

  return (
    <VStack
      justify={["center", "center", "space-between", "space-between", "space-between", "space-between"]}
      align={["center", "center", "stretch", "stretch", "stretch", "stretch"]}
      position="relative"
      h="100%"
      w="auto"
      py="10px"
    >
      {sections.map((section, i) => (
        <Box key={section.title + i}>
          <Text fontFamily="poppins" fontWeight={600} color="black" fontSize="20px">
            {section.title}
          </Text>
          {section.fields.map((label, idx) => (
            <SelectField key={`section-${i}-field-${idx}`} id={`section-${i}-field-${idx}`} label={label} options={section.options} />
          ))}
        </Box>
      ))}
<Box
  mt="10px"
  as="button"
  w="360px"
  borderRadius="16px"
  bg={speaking ? "gray.500" : "orange.400"}
  color="white"
  p="16px"
  textAlign="center"
  _hover={{ bg: speaking ? "gray.500" : "orange.500" }}
  _active={{ bg: speaking ? "gray.500" : "orange.600" }}
  fontFamily="poppins"
  fontWeight={700}
  cursor={speaking ? "not-allowed" : "pointer"}
  aria-disabled={speaking}
  onClick={handleGenerateDual}
  disabled={speaking}
>
  <HStack gap="10px" justify="center">
    <Text fontSize={["18px", "18px", "20px"]} lineHeight="1.1">
      {speaking ? "Generating…" : "Generate (Dual: Overlap)"}
    </Text>
  </HStack>
</Box>

    </VStack>
  );
}
