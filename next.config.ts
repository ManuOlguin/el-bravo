import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los worktrees viven dentro del repo principal (otro package-lock.json más arriba):
  // fijar la raíz evita que Turbopack infiera la equivocada.
  turbopack: { root: path.resolve(__dirname) },
  async redirects() {
    return [
      { source: "/profile/edit", destination: "/settings/profile", permanent: false }, // W1-4
      { source: "/load", destination: "/workout/new", permanent: false }, // W2-1
      { source: "/create-routine", destination: "/routines/new", permanent: false }, // W2-1
      { source: "/routine", destination: "/routines", permanent: false }, // W2-1
      { source: "/routine/:id/edit", destination: "/routines/:id/edit", permanent: false }, // W2-1
    ];
  },
};

export default nextConfig;
