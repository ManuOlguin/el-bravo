"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button, IconButton, Sheet, toast } from "@/src/components/ui";
import { getRoutineForEditorAction } from "@/src/server/actions/routines";
import { routineToText } from "./format";

type Shared = { title: string; text: string };

const subscribe = () => () => {};
const canShareNatively = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const noNativeShareOnServer = () => false;

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/**
 * Comparte la rutina como texto El Bravo en dos pasos. El tap trae el texto (await) y abre una hoja con
 * la vista previa; recién el tap en "Enviar…" o "Copiar" llama a `navigator.share` / `clipboard`, para que
 * iOS Safari vea el gesto del usuario (un await largo lo vence).
 */
export function ShareRoutineButton({ routineId, url }: { routineId: string; url?: string }) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);
  const [pending, start] = useTransition();
  const nativeShare = useSyncExternalStore(subscribe, canShareNatively, noNativeShareOnServer);

  const onOpen = () => {
    if (shared) {
      setOpen(true);
      return;
    }
    start(async () => {
      const r = await getRoutineForEditorAction(routineId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setShared({ title: r.data.name, text: routineToText(r.data, { url }) });
      setOpen(true);
    });
  };

  // Llamadas directas en el onClick: el primer `await` va después de invocar la API nativa.
  const onSend = async () => {
    if (!shared) return;
    try {
      await navigator.share({ title: shared.title, text: shared.text });
      setOpen(false);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      toast.error("No pudimos abrir el menú para compartir. Copiá el texto.");
    }
  };

  const onCopy = async () => {
    if (!shared) return;
    try {
      await navigator.clipboard.writeText(shared.text);
      toast.success("Rutina copiada: pegala en WhatsApp");
      setOpen(false);
    } catch {
      toast.error("No pudimos copiar. Mantené apretado el texto para copiarlo.");
    }
  };

  return (
    <>
      <IconButton label="Compartir rutina" variant="secondary" pending={pending} onClick={onOpen} className="h-11 w-11">
        <ShareIcon />
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Compartir rutina">
        {shared && (
          <div className="space-y-4">
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-2 p-3 font-sans text-sm text-fg">
              {shared.text}
            </pre>
            <div className="flex flex-col gap-2">
              {nativeShare ? (
                <>
                  <Button fullWidth onClick={() => void onSend()}>
                    Enviar…
                  </Button>
                  <Button fullWidth variant="secondary" onClick={() => void onCopy()}>
                    Copiar
                  </Button>
                </>
              ) : (
                <Button fullWidth onClick={() => void onCopy()}>
                  Copiar
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
