import Link from "next/link";
import { cn } from "./cn";

export function PageHeader({
  title,
  subtitle,
  back,
  onBack,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** href al que vuelve la flecha "←". */
  back?: string;
  /** Alternativa a `back` para pantallas internas (sin ruta propia): la flecha "←" llama a este callback. */
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex items-start gap-2", className)}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Volver" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-fg-muted transition-transform hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95">
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        back && (
        <Link
          href={back}
          aria-label="Volver"
          className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-fg-muted transition-transform hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
        >
          <span aria-hidden="true">←</span>
        </Link>
        )
      )}
      <div className="min-w-0 flex-1 py-1">
        <h1 className="text-2xl font-extrabold leading-tight break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
