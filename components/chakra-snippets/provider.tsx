// components/chakra-snippets/provider.tsx
"use client";

import { ChakraProvider } from "@chakra-ui/react";          // 👈 import from @chakra-ui/react
import { system } from "./theme";                          // 👈 your createSystem(...) export

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>                       {/* 👈 pass it as `value` */}
      {children}
    </ChakraProvider>
  );
}
