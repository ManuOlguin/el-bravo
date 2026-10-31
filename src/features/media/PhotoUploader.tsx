"use client";
import { useRef, useState } from "react";
import { Button, IconButton, Spinner, cn, toast } from "@/src/components/ui";
import type { UploadTarget } from "@/src/server/media/keys";
import { FileThumb } from "./FileThumb";
import { CameraIcon, CloseIcon, RetryIcon } from "./icons";
import { mapWithConcurrency } from "./pool";
import { uploadFile, type UploadedMedia } from "./upload";

type Item = { id: number; file: File; status: "uploading" | "error"; error?: string };

/**
 * Sube fotos en el momento (perfil, grupo o actividad ya creada). Muestra el progreso sobre la
 * miniatura y, si falla, avisa con `toast.error` y deja reintentar.
 */
export function PhotoUploader({
  target,
  onUploaded,
  multiple = false,
  max = multiple ? 4 : 1,
  label,
  className,
}: {
  target: UploadTarget;
  onUploaded(media: UploadedMedia): void;
  multiple?: boolean;
  /** Fotos por selección (p. ej. los lugares libres de la actividad). */
  max?: number;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const uploading = items.some((i) => i.status === "uploading");

  const patch = (id: number, p: Partial<Item> | null) =>
    setItems((list) => (p ? list.map((i) => (i.id === id ? { ...i, ...p } : i)) : list.filter((i) => i.id !== id)));

  const run = async (item: Item) => {
    patch(item.id, { status: "uploading", error: undefined });
    const r = await uploadFile(target, item.file);
    if (r.ok) {
      patch(item.id, null);
      onUploaded(r.data);
      toast.success(r.message ?? "Foto subida");
    } else {
      patch(item.id, { status: "error", error: r.error });
      toast.error(r.error, { action: { label: "Reintentar", onClick: () => void run(item) } });
    }
  };

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    if (files.length > max) toast.info(max === 1 ? "Elegí una sola foto." : `Podés subir hasta ${max} fotos.`);
    const fresh = files.slice(0, max).map<Item>((file) => ({ id: nextId.current++, file, status: "uploading" }));
    setItems((cur) => [...cur, ...fresh]);
    void mapWithConcurrency(fresh, 2, run);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
              <FileThumb file={item.file} className={cn(item.status === "uploading" && "opacity-60")} />
              {item.status === "uploading" ? (
                <div className="absolute inset-0 grid place-items-center text-fg" role="status" aria-label="Subiendo foto">
                  <Spinner size={22} />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-bg/70" title={item.error}>
                  <IconButton label="Reintentar" onClick={() => void run(item)} className="text-fg">
                    <RetryIcon />
                  </IconButton>
                  <IconButton label="Descartar" onClick={() => patch(item.id, null)} className="text-fg">
                    <CloseIcon />
                  </IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Button variant="secondary" pending={uploading} onClick={() => input.current?.click()}>
        <CameraIcon size={18} />
        {label ?? (multiple ? "Agregar fotos" : "Subir foto")}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
