import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los worktrees viven dentro del repo principal (otro package-lock.json más arriba):
  // fijar la raíz evita que Turbopack infiera la equivocada.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
