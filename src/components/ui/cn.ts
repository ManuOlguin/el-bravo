import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge resuelve conflictos (p. ej. `p-4` de base + `p-0` del consumidor:
// gana el último). Se le enseñan los tokens propios de `app/globals.css`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["card"],
      shadow: ["card"],
      animate: ["sheet-in", "modal-in"],
    },
  },
});

export function cn(...c: Array<string | false | null | undefined>) {
  return twMerge(c.filter(Boolean).join(" "));
}
