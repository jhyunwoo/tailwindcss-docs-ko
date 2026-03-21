import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".cache/**",
      ".next/**",
      "node_modules/**",
      "public/**",
      "data/docs-manifest.json",
      "src/content/docs/**",
      "src/content/generated.ts",
      "src/content/source/**",
      "src/docs/**",
      "src/components/api-table.tsx",
      "src/components/code-example.tsx",
      "src/components/color-palette.tsx",
      "src/components/color.tsx",
      "src/components/content.tsx",
      "src/components/copy-button.tsx",
      "src/components/dynamic-viewport-example.tsx",
      "src/components/example.tsx",
      "src/components/figure.tsx",
      "src/components/highlight-classes.ts",
      "src/components/highlight.tsx",
      "src/components/iframe.tsx",
      "src/components/multi-cursor/**",
      "src/components/segment.ts",
      "src/components/shiki.ts",
      "src/components/stripes.tsx",
      "src/components/syntax-highlighter/**",
      "src/components/theme-toggle.tsx",
      "src/components/tips.tsx",
      "src/components/tooltip.tsx",
    ],
  },
];

export default config;
