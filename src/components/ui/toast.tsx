"use client";
import { Toaster as SonnerToaster, toast } from "sonner";
import type { ActionResult } from "@/src/server/http/result";

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="dark"
      richColors
      closeButton
      offset={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 4rem)", left: "1rem", right: "1rem" }}
      toastOptions={{ classNames: { toast: "!bg-surface-2 !border-border !text-fg !font-sans" } }}
    />
  );
}

export function toastResult(result: ActionResult<unknown>, successFallback = "Listo") {
  if (result.ok) toast.success(result.message ?? successFallback);
  else toast.error(result.error);
  return result.ok;
}
