"use client";
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Input,
  LinkButton,
  Modal,
  NumberInput,
  PageHeader,
  Pill,
  ProgressBar,
  Select,
  Sheet,
  Skeleton,
  Slider,
  Spinner,
  StatCard,
  Switch,
  Tabs,
  Textarea,
  toast,
  toastResult,
  useConfirm,
} from "@/src/components/ui";
import { BadgesSection } from "./sections/badges";

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

function LayoutSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Layout">
      <Card className="space-y-0 p-0">
        <div className="p-4">
          <PageHeader title="Mis entrenamientos" subtitle="Últimos 30 días" back="/home" actions={<Button size="sm">Nuevo</Button>} />
        </div>
      </Card>
      <PageHeader title="Un título bastante largo que tiene que cortar bien en 375 px sin desbordar" />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Puntos" value={312} hint="+26 esta semana" tone="primary" />
        <StatCard label="Racha" value="4 sem" tone="gold" />
        <StatCard label="Días entrenados" value={18} />
        <StatCard label="Minutos" value="1.240" hint="20 h 40 min" />
      </div>
      <Card>
        <CardHeader title="Temporada de verano" subtitle="Termina el 15 de marzo" action={<Pill tone="primary">Activa</Pill>} />
        <ProgressBar value={0.62} label="Objetivo semanal" />
      </Card>
      <Card interactive as="section">
        <p className="text-sm">Card interactiva: tocala para ver el estado presionado.</p>
      </Card>
      <EmptyState
        icon={<PlusIcon />}
        title="Todavía no registraste entrenamientos"
        description="Cargá el primero y empezá a sumar puntos."
        action={<Button size="sm">Registrar</Button>}
      />
      <Row>
        <Button variant="secondary" size="sm" onClick={() => setLoading((v) => !v)}>
          {loading ? "Ocultar" : "Mostrar"} skeletons
        </Button>
      </Row>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      )}
    </Section>
  );
}

function DataSection() {
  const [tab, setTab] = useState("week");
  const [chips, setChips] = useState<string[]>(["Fuerza"]);
  const toggle = (c: string) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  return (
    <Section title="Datos">
      <Row>
        {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
          <Avatar key={size} name="Manu" size={size} />
        ))}
        <Avatar name="Leo" size="lg" href="/profile" />
        <Avatar name={null} size="md" />
      </Row>
      <Row>
        {["Fuerza", "Running", "Yoga", "Calistenia", "Crossfit", "Natación"].map((c) => (
          <Chip key={c} selected={chips.includes(c)} onClick={() => toggle(c)}>
            {c}
          </Chip>
        ))}
        <Chip size="sm" disabled>
          Deshabilitado
        </Chip>
      </Row>
      <Row>
        <Pill>Default</Pill>
        <Pill tone="primary">+26 pts</Pill>
        <Pill tone="danger">Vencida</Pill>
        <Pill tone="gold">Nivel III</Pill>
      </Row>
      <ProgressBar value={0.35} tone="gold" label="Gym Rat II → III" />
      <ProgressBar value={1} />
      <Tabs
        aria-label="Período"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "week", label: "Semana" },
          { id: "month", label: "Mes" },
          { id: "season", label: "Temporada" },
          { id: "year", label: "Año" },
          { id: "all", label: "Desde siempre" },
        ]}
      />
      <p className="text-xs text-fg-subtle">Tab activa: {tab}</p>
    </Section>
  );
}

function FormSection() {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(10);
  const [catWeight, setCatWeight] = useState(1);
  const [notify, setNotify] = useState(true);
  const [pending, setPending] = useState(false);
  const nameError = name.length > 0 && name.length < 3 ? "Tiene que tener al menos 3 letras" : undefined;
  return (
    <Section title="Formularios">
      <Card className="space-y-4">
        <Field label="Nombre de la rutina" htmlFor="dev-name" error={nameError} hint="Ej.: Empuje A">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Escribí un nombre" />
        </Field>
        <Field label="Con error fijo" htmlFor="dev-error" error="Este campo es obligatorio">
          <Input placeholder="Vacío" />
        </Field>
        <Field label="Notas" htmlFor="dev-notes">
          <Textarea placeholder="¿Cómo te sentiste?" />
        </Field>
        <Field label="Categoría" htmlFor="dev-category">
          <Select defaultValue="strength">
            <option value="strength">Fuerza</option>
            <option value="running">Running</option>
            <option value="yoga">Yoga</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso" htmlFor="dev-weight" hint={`valor: ${JSON.stringify(weight)}`}>
            <NumberInput value={weight} onChange={setWeight} min={0} max={500} step={0.5} suffix="kg" placeholder="—" />
          </Field>
          <Field label="Reps" htmlFor="dev-reps" hint={`valor: ${JSON.stringify(reps)}`}>
            <NumberInput value={reps} onChange={setReps} min={1} max={100} step={1} />
          </Field>
        </div>
        <Field label="Peso de la categoría" htmlFor="dev-slider">
          <Slider value={catWeight} onChange={setCatWeight} min={0} max={2} step={0.25} format={(v) => `×${v.toFixed(2).replace(".", ",")}`} />
        </Field>
        <Switch checked={notify} onChange={setNotify} label="Avisarme cuando un amigo entrena" description="Notificación push" />
        <Switch checked={false} onChange={() => {}} label="Deshabilitado" disabled />
        <Button
          fullWidth
          pending={pending}
          onClick={() => {
            setPending(true);
            setTimeout(() => {
              setPending(false);
              toast.success("Rutina guardada");
            }, 1500);
          }}
        >
          Guardar
        </Button>
      </Card>
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
      <LayoutSection />
      <DataSection />
      <FormSection />
      <BadgesSection />
    </div>
  );
}
