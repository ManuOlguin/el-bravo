"use client";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Modal, cn, toast, useConfirm } from "@/src/components/ui";
import { ChevronIcon } from "./icons";

export type GridPhoto = { id?: string; url: string; thumbUrl?: string | null };

/**
 * Fotos de una actividad en grilla (usa la miniatura si existe). Al tocar una se abre un visor
 * con swipe y botones ‹ ›. Si se pasa `onDelete`, el visor ofrece borrar (con confirmación).
 */
export function PhotoGrid({
  photos,
  onDelete,
  className,
}: {
  photos: GridPhoto[];
  onDelete?(id: string): void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const n = photos.length;

  return (
    <>
      <div className={cn("grid gap-1 overflow-hidden rounded-card", n > 1 && "grid-cols-2", className)}>
        {photos.map((p, i) => (
          <button
            key={p.id ?? p.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Ver foto ${i + 1} de ${n}`}
            className={cn(
              "relative overflow-hidden bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              n === 1 ? "aspect-[4/3]" : "aspect-square",
              n === 3 && i === 0 && "col-span-2 aspect-[2/1]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fotos del bucket (R2), sin optimizador */}
            <img src={p.thumbUrl || p.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <PhotoViewer
          photos={photos}
          index={Math.min(open, n - 1)}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  photos: GridPhoto[];
  index: number;
  onIndex(i: number): void;
  onClose(): void;
  onDelete?(id: string): void | Promise<void>;
}) {
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = photos.length;
  const photo = photos[index];
  const go = (d: number) => onIndex((index + d + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (n < 2) return;
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, onIndex]);

  const remove = async () => {
    if (!onDelete || !photo.id) return;
    const okToDelete = await confirm({ title: "¿Borrar esta foto?", confirmLabel: "Borrar", danger: true });
    if (!okToDelete) return;
    setDeleting(true);
    try {
      await onDelete(photo.id);
      if (n <= 1) onClose();
      else if (index === n - 1) onIndex(index - 1);
    } catch {
      toast.error("No pudimos borrar la foto. Probá de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={n > 1 ? `Foto ${index + 1} de ${n}` : "Foto"} className="max-w-screen-md">
      <div
        className="relative -m-4 flex items-center justify-center bg-bg"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null || n < 2) return;
          if (end - start < -50) go(1);
          else if (end - start > 50) go(-1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fotos del bucket (R2), sin optimizador */}
        <img src={photo.url} alt={`Foto ${index + 1} de ${n}`} className="max-h-[calc(90dvh-9.5rem)] w-full select-none object-contain" draggable={false} />
        {n > 1 && (
          <>
            <IconButton label="Foto anterior" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-bg/70 text-fg">
              <ChevronIcon dir="left" />
            </IconButton>
            <IconButton label="Foto siguiente" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-bg/70 text-fg">
              <ChevronIcon dir="right" />
            </IconButton>
          </>
        )}
      </div>
      {onDelete && photo.id && (
        <div className="mt-8 flex justify-end">
          <Button variant="danger" size="sm" pending={deleting} onClick={remove}>
            Borrar foto
          </Button>
        </div>
      )}
    </Modal>
  );
}
