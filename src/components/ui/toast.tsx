"use client";
import { useEffect, useRef } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";
import type { ActionResult } from "@/src/server/http/result";

export { toast };

/**
 * Los `<dialog>` modales (Modal/Sheet) viven en el top layer del navegador y tapaban los toasts.
 * Por eso el Toaster va dentro de un `popover="manual"` (también top layer) que se vuelve a mostrar
 * cada vez que se abre un diálogo: el último elemento agregado al top layer queda arriba de todo.
 */
function useTopLayer(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return; // navegador sin Popover API: queda como antes
    const raise = () => {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
        el.showPopover();
      } catch {
        // desconectado o API parcial: no rompe la app
      }
    };
    raise();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.target instanceof HTMLDialogElement && m.target.open)) raise();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true });
    return () => observer.disconnect();
  }, [ref]);
}

export function Toaster() {
  const layer = useRef<HTMLDivElement>(null);
  useTopLayer(layer);
  return (
    <div
      ref={layer}
      popover="manual"
      // Capa de tamaño 0 sin estilos de popover: los toasts se posicionan `fixed` respecto del viewport.
      className="pointer-events-none fixed inset-auto left-0 top-0 m-0 h-0 w-0 overflow-visible border-0 bg-transparent p-0 [&_li]:pointer-events-auto"
    >
      <SonnerToaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        offset={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 4rem)", left: "1rem", right: "1rem" }}
        toastOptions={{ classNames: { toast: "!bg-surface-2 !border-border !text-fg !font-sans" } }}
      />
    </div>
  );
}

export function toastResult(result: ActionResult<unknown>, successFallback = "Listo") {
  if (result.ok) toast.success(result.message ?? successFallback);
  else toast.error(result.error);
  return result.ok;
}
