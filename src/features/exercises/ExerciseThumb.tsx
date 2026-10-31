"use client";
import { useState } from "react";
import { cn } from "@/src/components/ui";

/** Trazos simples por grupo muscular (24×24, `currentColor`). */
const GROUP_PATHS: Record<string, string> = {
  chest: "M4 7c2.5-2 5.5-2 8 0c2.5-2 5.5-2 8 0v5c-2 3-6 3.5-8 1c-2 2.5-6 2-8-1z",
  back: "M6 4l6 3 6-3-1.5 15h-9zM12 7v12",
  legs: "M8 3v7l-2 11M16 3v7l2 11M8 10h8",
  shoulders: "M3 15c0-5.5 4-9 9-9s9 3.5 9 9M8.5 9.5a2 2 0 1 0 0-.1M15.5 9.5a2 2 0 1 0 0-.1",
  arms: "M4 19c0-6.5 2.5-11 7-13l2.5 3.5-3 2c3.5-.5 7.5 1.5 9 7.5z",
  core: "M8 4h8v16H8zM8 9.3h8M8 14.6h8M12 4v16",
};
const DEFAULT_PATH = "M3 12h4l2-5 4 10 2-5h6"; // cardio / otros

export function GroupIcon({ groupKey, size = 20, className }: { groupKey: string | null; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={(groupKey && GROUP_PATHS[groupKey]) || DEFAULT_PATH} />
    </svg>
  );
}

/** Miniatura del ejercicio: la imagen del dataset si hay, si no un ícono del grupo muscular principal. */
export function ExerciseThumb({
  mediaUrl,
  groupKey,
  size = "md",
  className,
}: {
  mediaUrl: string | null;
  groupKey: string | null;
  size?: "md" | "lg";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = size === "lg" ? "h-48 w-full rounded-card" : "h-11 w-11 shrink-0 rounded-xl";
  if (mediaUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imágenes externas del dataset abierto; sin optimización de Next
      <img
        src={mediaUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cn(box, "bg-surface-2", size === "lg" ? "object-contain" : "object-cover", className)}
      />
    );
  }
  return (
    <div className={cn(box, "grid place-items-center bg-surface-2 text-fg-muted", className)} aria-hidden="true">
      <GroupIcon groupKey={groupKey} size={size === "lg" ? 56 : 20} />
    </div>
  );
}
