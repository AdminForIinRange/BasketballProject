// theme.ts
import { defineConfig, createSystem, defaultConfig } from "@chakra-ui/react";
import { textStyles } from "./text-styles";

const config = defineConfig({
  // your existing globalCss stays where it is…
  globalCss: {
    html: {
      scrollBehavior: "auto !important",
      colorPalette: "blue",
    },
  },

  // …and now add textStyles
  theme: {
    textStyles,
    // (optionally) extend other theme keys here: tokens, recipes, etc.
  },
});

export const system = createSystem(defaultConfig, config);
