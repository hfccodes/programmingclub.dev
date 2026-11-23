//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  ...tanstackConfig,
  {
    files: ["**/*.{js,ts,tsx}"],
    rules: {
      "import/no-cycle": "error",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    files: ["convex/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "@tanstack/*",
                "@clerk/*",
                "@base-ui/*",
                "phaser",
                "three",
                "#/*",
                "../src/components/*",
                "../src/routes/*",
                "../src/game/*",
              ],
              message: "Convex functions run on the server. Share pure logic via ../src/lib/* instead of importing client or UI modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./.*convex/(?!_generated/)",
              message:
                "Client code may only import from convex/_generated/{api,dataModel}. Put shared pure logic in src/lib/* instead of importing Convex handlers directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/routes/hello-world/**/*.{ts,tsx}"],
    rules: {
      "no-alert": "error",
    },
  },
  {
    ignores: [
      "eslint.config.js",
      "prettier.config.js",
      "public/**",
      "convex/_generated/**",
      "test-results/**",
      ".agents/**",
      ".claude/**",
      ".tanstack/**",
      ".output/**",
      ".nitro/**",
      ".vercel/**",
    ],
  },
];
