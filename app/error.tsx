"use client";
import { useEffect } from "react";
import { Button, LinkButton } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-screen-sm px-4 py-10">
      <EmptyState
        icon={<span className="text-xl font-extrabold">!</span>}
        title="Algo salió mal"
        description="No pudimos cargar esta pantalla. Probá de nuevo en un rato."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => reset()}>Reintentar</Button>
            <LinkButton href="/home" variant="ghost">
              Ir al inicio
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
