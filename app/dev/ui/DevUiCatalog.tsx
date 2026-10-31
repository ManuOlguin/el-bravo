"use client";
import { useState } from "react";
import { Button, IconButton, LinkButton, Modal, Sheet, Spinner, toast, toastResult, useConfirm } from "@/src/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ButtonsSection() {
  const [pending, setPending] = useState(false);
  const trigger = () => {
    setPending(true);
    setTimeout(() => setPending(false), 1500);
  };
  return (
    <Section title="Botones">
      {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
        <Row key={variant}>
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
          <Button variant={variant} disabled>
            Deshabilitado
          </Button>
        </Row>
      ))}
      <Row>
        <Button pending={pending} onClick={trigger}>
          Guardar entrenamiento
        </Button>
        <Button variant="secondary" pending={pending} onClick={trigger}>
          Secundario
        </Button>
        <Button variant="danger" pending>
          Siempre pendiente
        </Button>
      </Row>
      <Button fullWidth size="lg" pending={pending} onClick={trigger}>
        Ancho completo (tocá para pending 1,5 s)
      </Button>
      <Row>
        <LinkButton href="/home">LinkButton a /home</LinkButton>
        <LinkButton href="/profile" variant="secondary">
          Perfil
        </LinkButton>
        <IconButton label="Agregar">
          <PlusIcon />
        </IconButton>
        <IconButton label="Agregar (pendiente)" pending>
          <PlusIcon />
        </IconButton>
        <Spinner size={24} className="text-primary" />
      </Row>
    </Section>
  );
}

function FeedbackSection() {
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <Section title="Feedback">
      <Row>
        <Button variant="secondary" size="sm" onClick={() => toast.success("Entrenamiento guardado")}>
          toast.success
        </Button>
        <Button variant="secondary" size="sm" onClick={() => toast.error("No pudimos guardar el entrenamiento")}>
          toast.error
        </Button>
        <Button variant="secondary" size="sm" onClick={() => toast.info("Tenés 2 entrenamientos esta semana")}>
          toast.info
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.promise(new Promise((res) => setTimeout(res, 1500)), {
              loading: "Guardando…",
              success: "¡Listo!",
              error: "Algo salió mal",
            })
          }
        >
          toast.promise
        </Button>
        <Button variant="secondary" size="sm" onClick={() => toastResult({ ok: false, error: "Error de ActionResult" })}>
          toastResult
        </Button>
      </Row>
      <Row>
        <Button
          variant="danger"
          onClick={async () => {
            const ok = await confirm({
              title: "¿Borrar entrenamiento?",
              description: "Se recalculan tus puntos e insignias. No se puede deshacer.",
              confirmLabel: "Borrar",
              danger: true,
            });
            toast.info(ok ? "Confirmaste (true)" : "Cancelaste (false)");
          }}
        >
          useConfirm (danger)
        </Button>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Abrir modal
        </Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Abrir sheet
        </Button>
      </Row>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal de ejemplo">
        <p className="mb-4 text-sm text-fg-muted">Se cierra con Esc, tocando afuera o con la cruz.</p>
        <Button fullWidth onClick={() => setModalOpen(false)}>
          Entendido
        </Button>
      </Modal>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Elegí un ejercicio">
        <ul className="divide-y divide-border">
          {Array.from({ length: 40 }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full py-3 text-left text-sm hover:text-primary active:opacity-70"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success(`Elegiste el ejercicio ${i + 1}`);
                }}
              >
                Ejercicio {i + 1}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Section>
  );
}

export function DevUiCatalog() {
  return (
    <div className="mx-auto w-full max-w-screen-sm space-y-8 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">Catálogo UI</h1>
        <p className="text-sm text-fg-muted">Primitivas de El Bravo v2. Solo visible en desarrollo.</p>
      </header>
      <ButtonsSection />
      <FeedbackSection />
    </div>
  );
}
