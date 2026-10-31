"use client";
import { useEffect, useRef, useState } from "react";

/** Ancho en px de un contenedor (ResizeObserver), para dibujar SVG en píxeles reales sin deformar. */
export function useWidth<T extends HTMLElement>(fallback = 343) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
