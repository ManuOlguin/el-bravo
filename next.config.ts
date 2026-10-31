import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los worktrees viven dentro del repo principal (otro package-lock.json más arriba):
  // fijar la raíz evita que Turbopack infiera la equivocada.
  turbopack: { root: path.resolve(__dirname) },
  async redirects() {
    return [
      { source: "/profile/edit", destination: "/settings/profile", permanent: false }, // W1-4
      { source: "/create-group", destination: "/groups/new", permanent: false }, // W2-2
      { source: "/group", destination: "/groups", permanent: false }, // W2-2
      { source: "/group/edit", destination: "/groups", permanent: false }, // W2-2
      { source: "/dashboard", destination: "/home", permanent: false }, // W2-2
      { source: "/group/:id/edit", destination: "/group/:id/settings", permanent: false }, // W2-2
      { source: "/group/:id/create-season", destination: "/group/:id/season/new", permanent: false }, // W2-2
    ];
  },
};

export default nextConfig;
