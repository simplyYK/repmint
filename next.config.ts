import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const createConfig = (phase: string): NextConfig => ({
  output: "export",
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-repmint-dev" : ".next-repmint",
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: __dirname,
});

export default createConfig;
