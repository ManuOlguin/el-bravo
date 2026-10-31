/** Íconos SVG inline por `iconKey` (sin dependencias). Usan `currentColor`. */

const PATHS: Record<string, React.ReactNode> = {
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 .8-3.4 2-4.5.2 1.6 1 2.5 2 2.5-.5-2.8.2-5.6 1-8Z" />,
  dumbbell: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </>
  ),
  run: (
    <>
      <circle cx="14.5" cy="4.5" r="1.5" />
      <path d="M8 21l3-6 3 2v4M7 11l3-3h4l2 4 3 1M11 15l-1-4" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  leg: <path d="M9 3h5l-1 8 2 6 4 2v2h-7l-1-3-3-7 1-8Z" />,
  abs: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="4" />
      <path d="M12 3v18M7 9h10M7 15h10" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sunrise: (
    <>
      <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 4v4M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4M9.5 6.5 12 4l2.5 2.5" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8" />
    </>
  ),
};

export function BadgeIcon({ iconKey, size = 28, className }: { iconKey: string | null; size?: number; className?: string }) {
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
      {PATHS[iconKey ?? ""] ?? PATHS.medal}
    </svg>
  );
}
