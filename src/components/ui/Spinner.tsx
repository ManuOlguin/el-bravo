import { cn } from "./cn";

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
