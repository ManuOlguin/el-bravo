import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los worktrees viven dentro del repo principal (otro package-lock.json más arriba):
  // fijar la raíz evita que Turbopack infiera la equivocada.
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  experimental: {
    // Límite subido para /routines/import (fase 3b): hasta 4 MB de fotos/PDF; Vercel corta en 4,5 MB.
    // Aplica a TODAS las acciones y Next lee el body antes de correrlas (requireUser no lo protege):
    // proxy.ts devuelve 413 a las que superen 1 MiB fuera de /routines/import.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // Headers de seguridad básicos (W3). Sin CSP todavía: los estilos/scripts inline de Next necesitan
  // nonces y conviene hacerlo con el deploy real (ver docs/security-review.md).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // clickjacking de los botones de admin
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/profile/edit", destination: "/settings/profile", permanent: false }, // W1-4
      { source: "/create-group", destination: "/groups/new", permanent: false }, // W2-2
      { source: "/group", destination: "/groups", permanent: false }, // W2-2
      { source: "/group/edit", destination: "/groups", permanent: false }, // W2-2
      { source: "/dashboard", destination: "/home", permanent: false }, // W2-2
      { source: "/group/:id/edit", destination: "/group/:id/settings", permanent: false }, // W2-2
      { source: "/group/:id/create-season", destination: "/group/:id/season/new", permanent: false }, // W2-2
      { source: "/load", destination: "/workout/new", permanent: false }, // W2-1
      { source: "/create-routine", destination: "/routines/new", permanent: false }, // W2-1
      { source: "/routine", destination: "/routines", permanent: false }, // W2-1
      { source: "/routine/:id/edit", destination: "/routines/:id/edit", permanent: false }, // W2-1
    ];
  },
};

export default nextConfig;
