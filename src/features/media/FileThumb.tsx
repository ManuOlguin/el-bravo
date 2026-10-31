"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/src/components/ui";

/** Vista previa local de un `File` (object URL creado y liberado con el ciclo de vida del componente). */
export function FileThumb({ file, className }: { file: Blob; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- object URL local, sin optimizador
  return <img ref={ref} alt="" className={cn("h-full w-full object-cover", className)} />;
}
