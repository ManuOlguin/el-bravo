# W0-B — Base UI (sistema de diseño + shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§4 Restricciones globales, §5.9 contrato de UI, §6.2 propiedad, §6.3 rutas).

**Goal:** que la app tenga un sistema visual coherente en modo oscuro (tokens, tipografía Montserrat), primitivas reutilizables con feedback claro (botón con estado *pending*, toasts, diálogos de confirmación, bottom sheets) y un shell mobile-first con navegación inferior. Además se corrige el cambio de colores en el modo oscuro del celular.

**Architecture:** los tokens se definen en `app/globals.css` (`@theme` de Tailwind 4). Las primitivas viven en `src/components/ui/*` y son componentes cliente chicos y sin estado global, salvo el Toaster (`sonner`) y el proveedor de confirmación. El shell (`src/components/shell/*`) se monta en `app/layout.tsx`. Una página de catálogo, `/dev/ui`, que solo existe en desarrollo, sirve para verificar todo a ojo.

**Tech Stack:** Tailwind 4, `next/font/google` (Montserrat), `sonner` (toasts), `<dialog>` nativo.

**Spec:** `docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md`

**Rama/worktree:** `v2/w0-b-ui` desde `rework/v2`. Puerto: 3002 (`PORT=3002 npm run dev`).

## Global Constraints
Ver `00-roadmap.md` §4. Este workstream es **dueño exclusivo** de `app/globals.css`, `app/layout.tsx`, `src/components/ui/**` y `src/components/shell/**`. **No migra pantallas existentes** (eso lo hace cada workstream de dominio). Solo reemplaza la navbar vieja por el shell.

**Verificación visual:** cada tarea se verifica en `http://localhost:3002/dev/ui` con viewport de 375×812 y de 1280×800. Hay que chequear que no haya scroll horizontal y que los estados `hover`, `active` (presionado), `focus-visible`, `disabled` y `pending` se vean.

---

### Task 1: Tokens, tipografía y corrección del modo oscuro

**Files:**
- Modify: `app/globals.css` (reemplazo completo)
- Modify: `app/layout.tsx`

**Interfaces:**
- Produce: las utilidades Tailwind `bg-bg`, `bg-surface-1..3`, `border-border`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `bg-primary`, `text-primary`, `bg-primary-strong`, `text-on-primary`, `bg-danger`, `text-danger`, `bg-success`, `text-gold`, `text-silver`, `text-bronze`, `rounded-card`, `font-sans`, `shadow-card`, `bg-primary-gradient` (clase utilitaria).

- [ ] **Step 1: `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-bg: #08142d;
  --color-surface-1: #0f1d35;
  --color-surface-2: #172742;
  --color-surface-3: #22365a;
  --color-border: #2c4268;
  --color-fg: #ffffff;
  --color-fg-muted: #a3b3cc;
  --color-fg-subtle: #6b7f9e;
  --color-primary: #8ac617;
  --color-primary-strong: #63710b;
  --color-on-primary: #0b1500;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-gold: #facc15;
  --color-silver: #cbd5e1;
  --color-bronze: #d97706;

  --font-sans: var(--font-montserrat), ui-sans-serif, system-ui, sans-serif;
  --radius-card: 1.25rem;
  --shadow-card: 0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6);
}

:root {
  color-scheme: dark;
}

@layer base {
  html, body {
    background-color: var(--color-bg);
    color: var(--color-fg);
  }
  body {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior-y: none;
  }
  input, select, textarea, button { font: inherit; }
}

@utility bg-primary-gradient {
  background-image: linear-gradient(to bottom, var(--color-primary), var(--color-primary-strong));
}

@utility pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);
}
```

Esto elimina el bloque `:root` claro y el `@media (prefers-color-scheme: dark)` que causaban el cambio de colores, además del `@theme inline` duplicado y de los tokens viejos (`surface`, `surfacehover`, `calendar*`, `graytext`).

**Antes de borrar los tokens viejos**, buscar sus usos con `grep -rn "surfacehover\|bg-surface\b\|calendarweek\|calendargreen\|calendargray\|graytext" app src`. Reemplazarlos por el token nuevo más cercano (`bg-surface` → `bg-surface-2`, `bg-surfacehover` → `bg-surface-3`, `calendar*` → `bg-surface-1`/`bg-primary`, `text-graytext` → `text-fg-subtle`). Son menos de 10 usos.

- [ ] **Step 2: `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/src/components/shell/AppShell";
import { Providers } from "@/src/components/ui/Providers";
import { getSession } from "@/src/server/auth/dal";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "El Bravo", template: "%s · El Bravo" },
  description: "Entrená con tus amigos, sumá puntos y competí por temporadas.",
};

export const viewport: Viewport = {
  themeColor: "#08142d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="es-AR" className={`${montserrat.variable} dark`} style={{ colorScheme: "dark" }}>
      <body className="min-h-dvh bg-bg text-fg font-sans">
        <Providers>
          <AppShell user={session ? { id: session.id, name: session.name, photoUrl: session.photoUrl } : null}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

**Dependencia:** `getSession` sale de W0-A (`src/server/auth/dal.ts`). Si W0-A todavía no se mergeó en tu worktree, crear un archivo temporal `src/server/auth/dal.ts` que reexporte `getCurrentUser` como `getSession`, con este comentario arriba:

```ts
// TEMP W0-B: se reemplaza al mergear W0-A
```

El orquestador resuelve el conflicto quedándose con la versión de W0-A.

`themeColor` es el único hex permitido fuera de `globals.css`. Agregar `app/layout.tsx` a la baseline de colores con `node scripts/check-colors.mjs --update`.

- [ ] **Step 3: Verificar el modo oscuro**

Run: `PORT=3002 npm run dev`. En el navegador, forzar `prefers-color-scheme: light` y después `dark` (DevTools → Rendering).

Expected:
- El fondo del body y el overscroll quedan en `#08142d` en ambos casos.
- Los inputs `date`/`time`/`select` tienen controles oscuros.
- No hay flash blanco al recargar.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(ui): design tokens, Montserrat and forced dark color-scheme"
```

---

### Task 2: Botones con feedback (Button, LinkButton, IconButton, Spinner)

**Files:**
- Create: `src/components/ui/cn.ts`
- Create: `src/components/ui/Spinner.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/index.ts` (barrel)
- Create: `app/dev/ui/page.tsx` (catálogo, solo en dev)

**Interfaces:**
- Produce:
  - `cn(...classes)`.
  - `<Button variant size pending fullWidth ...buttonProps>`.
  - `<LinkButton href variant size fullWidth>`.
  - `<IconButton label pending ...>`.
  - `<Spinner size>`.

- [ ] **Step 1: `cn.ts`**

```ts
export function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: `Spinner.tsx`**

```tsx
import { cn } from "./cn";
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: `Button.tsx`**

```tsx
"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none " +
  "transition-[transform,background-color,opacity] duration-100 active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary-gradient text-on-primary hover:brightness-110",
  secondary: "bg-surface-3 text-fg hover:bg-border",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-5 text-base",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: Size; pending?: boolean; fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", pending = false, fullWidth, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-2", pending && "invisible")}>{children}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
});

export function LinkButton({
  href, variant = "primary", size = "md", fullWidth, className, children, ...rest
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; fullWidth?: boolean }) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({
  label, className, ...rest
}: Omit<ButtonProps, "children" | "size"> & { label: string; children: React.ReactNode }) {
  return (
    <Button aria-label={label} title={label} variant="ghost" className={cn("h-10 w-10 p-0", className)} {...rest} />
  );
}
```

(`h-13` no existe por defecto en Tailwind 4: o se agrega `--spacing-13: 3.25rem` en `@theme` (recomendado), o se usa `h-[3.25rem]`.)

- [ ] **Step 4: Catálogo `/dev/ui`**

`app/dev/ui/page.tsx` es un Server Component que hace `if (process.env.NODE_ENV === "production") notFound();` y renderiza un componente cliente `DevUiCatalog`, que vive en `app/dev/ui/DevUiCatalog.tsx`. El catálogo muestra:
- todas las variantes y tamaños de `Button`;
- un botón que alterna `pending` durante 1,5 s;
- `LinkButton` e `IconButton`.

Cada tarea siguiente agrega su sección.

- [ ] **Step 5: Verificar**

`/dev/ui` en 375 px:
- Al presionar, el botón se achica (`active:scale`).
- Con `pending`, el ancho no cambia y aparece el spinner centrado.
- El foco con teclado muestra el anillo lima.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui app/dev
git commit -m "feat(ui): Button with pending state, LinkButton, IconButton"
```

---

### Task 3: Toasts, diálogos y bottom sheets

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/Providers.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Sheet.tsx`
- Create: `src/components/ui/ConfirmDialog.tsx` (incluye `ConfirmProvider` y `useConfirm`)

**Interfaces:**
- Produce:
  - `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`, `toast.promise(p, {loading, success, error})`.
  - `<Toaster/>` y `<Providers>`.
  - `<Modal open onClose title>`.
  - `<Sheet open onClose title>`: bottom sheet en mobile, modal centrado desde `sm:`.
  - `useConfirm()`, que devuelve `(opts: { title: string; description?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>`.
  - `toastResult(result: ActionResult<unknown>, successFallback?: string)`: helper que muestra success o error según el resultado.

- [ ] **Step 1: Instalar**

```bash
npm install sonner@^2
```

- [ ] **Step 2: `toast.tsx`**

```tsx
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
      toastOptions={{ classNames: { toast: "!bg-surface-2 !border-border !text-fg !font-sans" } }}
    />
  );
}

export function toastResult(result: ActionResult<unknown>, successFallback = "Listo") {
  if (result.ok) toast.success(result.message ?? successFallback);
  else toast.error(result.error);
  return result.ok;
}
```

(Si `src/server/http/result.ts` todavía no existe en el worktree porque W0-A no se mergeó, declarar el tipo localmente con un comentario `// TEMP W0-B`.)

- [ ] **Step 3: `Modal.tsx` y `Sheet.tsx` sobre `<dialog>`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { cn } from "./cn";

export function Modal({
  open, onClose, title, children, className, variant = "center",
}: { open: boolean; onClose(): void; title?: string; children: React.ReactNode; className?: string; variant?: "center" | "sheet" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cn(
        "m-0 max-h-[90dvh] w-full max-w-none overflow-hidden bg-surface-1 p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        variant === "sheet"
          ? "fixed inset-x-0 bottom-0 top-auto rounded-t-[var(--radius-card)] pb-safe sm:inset-auto sm:m-auto sm:max-w-lg sm:rounded-[var(--radius-card)]"
          : "m-auto max-w-md rounded-[var(--radius-card)]",
        className
      )}
    >
      <div className="flex max-h-[90dvh] flex-col">
        {title && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 active:scale-95">✕</button>
          </div>
        )}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
```

`Sheet.tsx`:

```tsx
"use client";
import { Modal } from "./Modal";
export function Sheet(props: Omit<React.ComponentProps<typeof Modal>, "variant">) {
  return <Modal {...props} variant="sheet" />;
}
```

- [ ] **Step 4: `ConfirmDialog.tsx`**

```tsx
"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

type Opts = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
const Ctx = createContext<((o: Opts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback((o: Opts) => {
    setOpts(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);
  const close = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => close(false)} title={opts?.title}>
        {opts?.description && <p className="mb-4 text-sm text-fg-muted">{opts.description}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>{opts?.cancelLabel ?? "Cancelar"}</Button>
          <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {opts?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm requiere <ConfirmProvider>");
  return c;
}
```

- [ ] **Step 5: `Providers.tsx`**

```tsx
"use client";
import { ConfirmProvider } from "./ConfirmDialog";
import { Toaster } from "./toast";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      {children}
      <Toaster />
    </ConfirmProvider>
  );
}
```

- [ ] **Step 6: Catálogo**

En `/dev/ui`, agregar una sección "Feedback" con botones que disparen:
- `toast.success`, `toast.error` y `toast.promise` (una promesa de 1,5 s);
- `useConfirm` con `danger`;
- un `Modal`;
- un `Sheet` con lista larga, para probar el scroll interno.

- [ ] **Step 7: Verificar**

En 375 px:
- El sheet aparece desde abajo, respeta el safe-area y se cierra con Esc, con tap afuera y con ✕.
- El confirm devuelve `true`/`false` (mostrar el resultado con un toast).
- Los toasts no tapan la bottom nav.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui app/dev package.json package-lock.json
git commit -m "feat(ui): toasts, modal, bottom sheet and confirm dialog"
```

---

### Task 4: Primitivas de layout y formularios

**Files:**
- Create: `src/components/ui/Card.tsx` (`Card`, `CardHeader`, `StatCard`)
- Create: `src/components/ui/Avatar.tsx`
- Create: `src/components/ui/Chip.tsx` (`Chip`, `Pill`)
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/PageHeader.tsx`
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/ProgressBar.tsx`
- Create: `src/components/ui/Tabs.tsx`
- Create: `src/components/ui/form.tsx` (`Field`, `Input`, `Textarea`, `Select`, `NumberInput`, `Slider`, `Switch`)

**Interfaces (props exactas):**
- `Card({ className, children, as?: "div"|"section"|"li", interactive?: boolean })`: `rounded-card bg-surface-1 border border-border shadow-card p-4`. Con `interactive`, suma `active:scale-[0.99] hover:bg-surface-2`.
- `CardHeader({ title, action?: ReactNode, subtitle? })`.
- `StatCard({ label, value: ReactNode, hint?, tone?: "default"|"primary"|"gold" })`. El valor va en `text-3xl font-extrabold` y la etiqueta en `text-xs text-fg-muted uppercase tracking-wide`.
- `Avatar({ name, src?, size?: "xs"|"sm"|"md"|"lg"|"xl", href? })`: si no hay `src`, muestra la inicial sobre `bg-surface-3`. Con `href`, envuelve en `<Link>`. Las imágenes usan `<img loading="lazy" decoding="async">` con `object-cover`.
- `Chip({ selected?, onClick?, children, size?: "sm"|"md" })`: un `role="button"` con `aria-pressed`. `Pill({ tone?: "default"|"primary"|"danger"|"gold", children })` no es interactivo.
- `EmptyState({ icon?: ReactNode, title, description?, action?: ReactNode })`.
- `PageHeader({ title, subtitle?, back?: string /* href */, actions?: ReactNode })`: el título va en `text-2xl font-extrabold` (nunca más grande en mobile). `back` muestra "←" con `<Link>`.
- `Skeleton({ className })`: `animate-pulse bg-surface-2 rounded-lg`.
- `ProgressBar({ value: number /* 0..1 */, tone?: "primary"|"gold", label?: string })`.
- `Tabs({ tabs: {id,label}[], value, onChange })`: segmentado, con scroll horizontal si no entra.
- Formularios: `Field({ label, htmlFor, error?: string, hint?, children })` muestra el error en `text-danger text-xs` con `role="alert"`. `Input`, `Textarea` y `Select` reenvían ref y props, usan `h-11 rounded-xl bg-surface-2 border border-border focus:border-primary` y llevan `aria-invalid` cuando hay error.
  - `NumberInput({ value: number|null, onChange(v: number|null), min?, max?, step?, suffix? })`: `inputMode="decimal"`. **El campo vacío equivale a `null`, no a `0`**, y el valor se clampa recién en `onBlur`.
  - `Slider({ value, onChange, min, max, step, format?(v): string })`: nativo `input[type=range]` con `accent-color: var(--color-primary)` y el valor formateado a la derecha.
  - `Switch({ checked, onChange, label })`: `role="switch"`.

- [ ] **Step 1: Implementar cada archivo** según las props de arriba. Reglas: solo tokens, sin hex, y en mobile todo cabe en 343 px de ancho útil (375 − 2×16).
- [ ] **Step 2: Agregar cada primitiva al catálogo `/dev/ui`**, con estados de error, de vacío y de carga.
- [ ] **Step 3: Verificar** en 375 px y en 1280 px: no hay scroll horizontal, los inputs no hacen zoom en iOS (`text-base` como mínimo en inputs, o sea 16 px) y `NumberInput` permite borrar el campo.
- [ ] **Step 4: Commit**

```bash
git add src/components/ui app/dev
git commit -m "feat(ui): layout, data display and form primitives"
```

---

### Task 5: Shell de la app (barra superior + navegación inferior) y páginas de estado

**Files:**
- Create: `src/components/shell/nav-items.ts`
- Create: `src/components/shell/TopBar.tsx`
- Create: `src/components/shell/BottomNav.tsx`
- Create: `src/components/shell/AppShell.tsx`
- Create: `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`
- Delete: `src/components/Navbar.tsx`, `src/components/AppNavbarShell.tsx` (verificar con grep que nadie más los importe)

**Interfaces:**
- Produce:
  - `NAV_ITEMS: NavItem[]` con `type NavItem = { id: "home"|"groups"|"log"|"stats"|"profile"; label: string; href: string; icon: IconName; enabled: boolean; primary?: boolean }`.
  - `AppShell({ user, children })`.
  - El slot `TopBar` acepta `rightSlot?: ReactNode` (la campana la agrega W2-3).

- [ ] **Step 1: `nav-items.ts`**

```ts
export type NavItem = { id: "home" | "groups" | "log" | "stats" | "profile"; label: string; href: string; enabled: boolean; primary?: boolean };

// Cada workstream habilita su ítem cuando su página existe (ver 00-roadmap §6.3).
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Inicio", href: "/home", enabled: true },
  { id: "groups", label: "Grupos", href: "/groups", enabled: false },
  { id: "log", label: "Registrar", href: "/load", enabled: true, primary: true }, // W2-1 lo cambia a /workout/new
  { id: "stats", label: "Stats", href: "/stats", enabled: false },
  { id: "profile", label: "Perfil", href: "/profile", enabled: true },
];
```

- [ ] **Step 2: `BottomNav.tsx`**

Es un componente cliente con `usePathname`:
- **Posición:** `fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1/95 backdrop-blur pb-safe sm:hidden`.
- **Ítems:** cada uno es un `<Link>` con ícono (SVG inline de 24 px: casa, personas, +, barras, persona) y la etiqueta en `text-[11px]`. Mientras un ítem está deshabilitado (`enabled: false`), se muestra atenuado con `aria-disabled`, no navega y muestra el tooltip "Próximamente".
- **Ítem activo:** el ítem cuya `href` es prefijo de la ruta queda en `text-primary`.
- **Ítem `primary` (Registrar):** círculo `bg-primary-gradient` de 52 px elevado, con `active:scale-95`.

- [ ] **Step 3: `TopBar.tsx`**

- **Contenedor:** `sticky top-0 z-30 h-14 border-b border-border bg-bg/90 backdrop-blur`.
- **Izquierda:** el logo-texto "El Bravo" (`font-extrabold`) es un `<Link href="/home">`.
- **Derecha:** `rightSlot`, y después un `Avatar` (size `sm`, `href="/profile"`).
- **Desktop (`sm:` en adelante):** además muestra los links de `NAV_ITEMS` habilitados, en línea.
- **Sin usuario:** muestra solo el logo.
- **Nunca se desborda en 375 px:** el nombre del usuario **no** se muestra en la barra.

- [ ] **Step 4: `AppShell.tsx`**

```tsx
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
export function AppShell({ user, children }: { user: { id: string; name: string | null; photoUrl: string | null } | null; children: React.ReactNode }) {
  if (!user) return <main className="min-h-dvh">{children}</main>;
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-screen-sm px-4 pb-28 pt-4 sm:max-w-screen-md sm:pb-10">{children}</main>
      <BottomNav />
    </>
  );
}
```

Nota: las páginas existentes hoy tienen su propio `<main className="min-h-screen bg-[#08142d] p-6">`. Quedan anidadas y funcionan, aunque con padding doble. Cada workstream lo limpia al migrar su página. **No migrar páginas acá.**

- [ ] **Step 5: Páginas de estado**
  - `app/loading.tsx`: un `PageHeader` en skeleton y 3 `Skeleton` de cards.
  - `app/error.tsx` (cliente): "Algo salió mal" + `Button` "Reintentar" que llama a `reset()`.
  - `app/not-found.tsx`: `EmptyState` "No encontramos esta página" + `LinkButton` a `/home`.

- [ ] **Step 6: Verificar**

En 375 px:
- `/home`, `/profile` y `/load` muestran la top bar sin desborde y la bottom nav fija. El contenido no queda tapado: el último elemento se puede leer.
- El ítem activo se resalta.
- `/login` no muestra el shell.
- En desktop (1280 px) la bottom nav desaparece y los links aparecen en la top bar.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/shell src/components/Navbar.tsx src/components/AppNavbarShell.tsx app/loading.tsx app/error.tsx app/not-found.tsx app/layout.tsx
git commit -m "feat(ui): app shell with top bar, mobile bottom nav and status pages"
```

---

### Verificación final de W0-B

- [ ] `npm run typecheck && npm run lint && npm run lint:colors && npm run build` en verde. `lint:colors` no tiene que reportar archivos nuevos con hex, salvo `app/layout.tsx` (themeColor), que está en la baseline.
- [ ] `/dev/ui` muestra todas las primitivas. Capturar screenshots en 375 px y adjuntarlos al pedido de review.
- [ ] En un celular real o en un emulador con "modo oscuro" y "auto dark" de Chrome, los colores ya no cambian.
- [ ] Pedir review y merge a `rework/v2`.
