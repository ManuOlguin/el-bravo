import type { Metadata } from "next";
import { LinkButton } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-screen-sm px-4 py-10">
      <EmptyState
        icon={<span className="text-lg font-extrabold">404</span>}
        title="No encontramos esta página"
        description="Puede que el link esté mal o que la página ya no exista."
        action={<LinkButton href="/home">Volver al inicio</LinkButton>}
      />
    </div>
  );
}
