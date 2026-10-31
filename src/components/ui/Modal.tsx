"use client";
import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

export type ModalProps = {
  open: boolean;
  onClose(): void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "center" | "sheet";
};

/**
 * Diálogo modal sobre `<dialog>` nativo: foco atrapado, Esc y tap afuera cierran.
 * `variant="sheet"` lo muestra como bottom sheet en mobile y centrado desde `sm:`.
 */
export function Modal({ open, onClose, title, children, className, variant = "center" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Evita que la página de fondo scrollee mientras el diálogo está abierto (iOS).
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "max-h-[90dvh] overflow-hidden border border-border bg-surface-1 p-0 text-fg shadow-card",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        variant === "sheet"
          ? "mx-0 mb-0 mt-auto w-full max-w-none animate-sheet-in rounded-t-card border-b-0 pb-safe sm:m-auto sm:max-w-lg sm:animate-modal-in sm:rounded-card sm:border-b sm:pb-0"
          : "m-auto w-[calc(100%-2rem)] max-w-md animate-modal-in rounded-card",
        className
      )}
    >
      <div className="flex max-h-[90dvh] flex-col">
        {variant === "sheet" && (
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
        )}
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 id={titleId} className="min-w-0 truncate text-base font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-transform hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </dialog>
  );
}
