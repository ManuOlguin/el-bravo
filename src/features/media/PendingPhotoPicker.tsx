"use client";
import { useRef } from "react";
import { toast } from "@/src/components/ui";
import { MAX_ACTIVITY_PHOTOS } from "@/src/server/media/keys";
import { FileThumb } from "./FileThumb";
import { CameraIcon, CloseIcon } from "./icons";

/**
 * Selector de fotos para el formulario de entrenamiento, antes de que exista la actividad.
 * Solo guarda `File`s: la subida la hace `uploadPendingPhotos` después de crear la actividad.
 */
export function PendingPhotoPicker({
  value,
  onChange,
  max = MAX_ACTIVITY_PHOTOS,
}: {
  value: File[];
  onChange(files: File[]): void;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const remaining = max - value.length;

  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || f.type === "");
    if (picked.length === 0) return;
    if (picked.length > remaining) toast.info(`Podés agregar hasta ${max} fotos.`);
    onChange([...value, ...picked.slice(0, Math.max(0, remaining))]);
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {value.map((file, i) => (
        <div key={`${file.name}-${file.lastModified}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
          <FileThumb file={file} />
          <button
            type="button"
            aria-label="Quitar foto"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-bg/80 text-fg backdrop-blur-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-90"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-1 text-xs font-semibold text-fg-muted transition-[transform,background-color] hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
        >
          <CameraIcon />
          <span>Agregar foto</span>
          <span className="text-fg-subtle">
            {value.length}/{max}
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
