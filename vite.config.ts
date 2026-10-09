import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset paths so the build works at any sub-path (e.g. GitHub Pages /FaceToREADME/).
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
