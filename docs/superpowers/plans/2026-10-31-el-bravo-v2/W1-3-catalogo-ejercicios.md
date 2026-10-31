# W1-3 — Catálogo de ejercicios, info "?", sinónimos y búsqueda tipo Strong Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D6, §4, §5.7, §6.2).

**Goal:** un catálogo de ejercicios rico y fácil de buscar. Cada ejercicio tiene equipamiento, descripción, pasos, imagen y sinónimos (también en inglés). La búsqueda es tolerante a acentos y errores de tipeo, con filtros por músculo y equipamiento y una sección de recientes. Hay un botón "?" que muestra cómo se hace cada ejercicio, y la creación de ejercicios propios permite elegir "por tiempo" y oculta automáticamente la lista de músculos.

**Architecture:**
- **Servidor:** una query devuelve el catálogo completo (unos 100 ítems más los ejercicios propios del usuario) como `CatalogEntry[]`.
- **Cliente:** la búsqueda es una función pura en el cliente, sin round-trips, cacheada en memoria con `useExerciseCatalog`.
- **Componentes:** `ExercisePicker` (un bottom sheet), `ExerciseInfoButton` (un diálogo) y `CreateExerciseSheet` con `MuscleShareEditor`.
- **Contenido:** los datos viven en `prisma/seed/data/exercises.json`, generados por un script y revisados por un humano.

**Tech Stack:** TypeScript, Zod, primitivas UI de W0-B, R2 (vía W1-5) o `public/` para las imágenes.

**Spec:** `00-roadmap.md` (D6). **Depende de:** W0-B y W0-C. **Rama:** `v2/w1-3-exercises`. Puerto 3013. Preparar la DB con `npm run db:worktree -- w1-3 3013`.

## Global Constraints
Ver `00-roadmap.md` §4. Este workstream es dueño de `prisma/seed/exercises.ts` y `prisma/seed/data/**`, pero **no** del schema: los campos `nameEn`, `description`, `instructions`, `mediaUrl`, `equipment`, `tracksWeight`, `createdByUserId` y `ExerciseAlias` ya existen desde W0-C.

---

### Task 1: Búsqueda pura (normalización, alias, fuzzy, filtros)

**Files:**
- Create: `src/features/exercises/search.ts`
- Test: `src/features/exercises/search.test.ts`

**Interfaces:**
- Produce:

```ts
export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "band" | "cardio" | "other";
export type CatalogEntry = ExerciseSummary & { aliases: string[]; groupKeys: string[]; isMine: boolean };
export function normalize(s: string): string; // minúsculas, sin acentos, sin signos, espacios colapsados
export function searchExercises(catalog: CatalogEntry[], query: string, filters?: { groupKey?: string; equipment?: Equipment }): CatalogEntry[];
```

Reglas de ranking (de mayor a menor):
1. El nombre normalizado es igual a la query.
2. El nombre empieza con la query.
3. Algún alias, o `nameEn`, empieza con la query.
4. Todas las palabras de la query son prefijo de alguna palabra del nombre o de un alias, en cualquier orden ("banca press" encuentra "Press banca").
5. Coincidencia aproximada: cada palabra de la query, si tiene ≥ 4 letras, admite **1 error** (distancia de Levenshtein ≤ 1) contra alguna palabra del nombre o de un alias.

Desempate: los ejercicios propios del usuario primero; después, orden alfabético.

Con la query vacía se devuelve todo el catálogo filtrado, en orden alfabético.

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from "vitest";
import { searchExercises, normalize, type CatalogEntry } from "./search";

const e = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name, name, nameEn: null, measureType: "reps", equipment: "other", tracksWeight: true, primaryGroupKey: null, mediaUrl: null,
  aliases: [], groupKeys: [], isMine: false, ...o,
});
const catalog = [
  e("Press banca", { nameEn: "Bench Press", aliases: ["pecho plano", "press de banca"], equipment: "barbell", groupKeys: ["chest", "arms"] }),
  e("Extensión de tríceps en polea", { nameEn: "Triceps Pushdown", aliases: ["triceps polea"], equipment: "cable", groupKeys: ["arms"] }),
  e("Jalón al pecho", { nameEn: "Lat Pulldown", equipment: "machine", groupKeys: ["back"] }),
  e("Sentadilla", { nameEn: "Squat", aliases: ["squat"], equipment: "barbell", groupKeys: ["legs"] }),
  e("Plancha", { nameEn: "Plank", measureType: "duration", equipment: "bodyweight", groupKeys: ["core"] }),
];

describe("normalize", () => {
  it("quita acentos, mayúsculas y signos", () => expect(normalize("  Jalón  al PECHO! ")).toBe("jalon al pecho"));
});

describe("searchExercises", () => {
  const names = (q: string, f?: Parameters<typeof searchExercises>[2]) => searchExercises(catalog, q, f).map((x) => x.name);
  it("ignora acentos", () => expect(names("jalon")).toEqual(["Jalón al pecho"]));
  it("encuentra por nombre en inglés y por alias", () => {
    expect(names("bench")).toEqual(["Press banca"]);
    expect(names("pushdown")).toEqual(["Extensión de tríceps en polea"]);
    expect(names("squat")).toEqual(["Sentadilla"]);
  });
  it("palabras en cualquier orden", () => expect(names("banca press")).toEqual(["Press banca"]));
  it("tolera un error de tipeo", () => expect(names("sentadila")).toEqual(["Sentadilla"]));
  it("prioriza prefijo de nombre sobre alias", () => {
    const c = [...catalog, e("Pecho en máquina", { groupKeys: ["chest"] })];
    expect(searchExercises(c, "pecho").map((x) => x.name)[0]).toBe("Pecho en máquina");
  });
  it("filtra por grupo muscular y equipamiento", () => {
    expect(names("", { groupKey: "arms" })).toEqual(["Extensión de tríceps en polea", "Press banca"]);
    expect(names("", { equipment: "barbell" })).toEqual(["Press banca", "Sentadilla"]);
  });
  it("los propios primero", () => {
    const c = [...catalog, e("Press banca inclinado (mío)", { isMine: true })];
    expect(searchExercises(c, "press").map((x) => x.name)[0]).toBe("Press banca inclinado (mío)");
  });
});
```

Run: `npx vitest run src/features/exercises` → FAIL.

- [ ] **Step 2: Implementar.** Levenshtein con un tope: cortar si la diferencia de largo es mayor que 1.
- [ ] **Step 3:** correr hasta PASS.
- [ ] **Step 4: Commit**

```bash
git add src/features/exercises/search.ts src/features/exercises/search.test.ts
git commit -m "feat(exercises): accent-insensitive fuzzy search with aliases and filters"
```

---

### Task 2: Contenido del catálogo (datos + seed)

**Files:**
- Create: `prisma/seed/data/exercises.json` (fuente de verdad del catálogo)
- Create: `scripts/exercises/draft-content.ts` (genera borradores de textos para revisar)
- Create: `scripts/exercises/match-free-exercise-db.ts` (asocia imágenes del dataset abierto)
- Create: `scripts/exercises/validate.ts` + `src/features/exercises/catalog-schema.ts` (Zod del JSON)
- Test: `src/features/exercises/catalog-data.test.ts`
- Modify: `prisma/seed/exercises.ts` (lee el JSON)

**Interfaces:**
- Formato de cada entrada del JSON (validado con Zod):

```ts
{
  slug: string; name: string; nameEn: string | null;
  equipment: Equipment; measureType: "reps" | "duration"; tracksWeight: boolean;
  aliases: { alias: string; locale: "es" | "en" }[];
  muscles: { slug: string; percentage: number }[]; // suma 100
  description: string;          // 1–2 oraciones, es-AR
  instructions: string[];       // 3–6 pasos, es-AR, imperativo con "vos" ("Apoyá…", "Bajá…")
  media: { source: "free-exercise-db" | "svg" | "none"; path: string | null; license: string | null };
  reviewed: boolean;            // true solo cuando un humano revisó textos e imagen
}
```

- [ ] **Step 1: Exportar los 78 ejercicios actuales** de `prisma/seed/exercises.ts` al JSON, con `reviewed: false`, `description: ""`, `instructions: []` y `media.source: "none"`. Completar `equipment` y `tracksWeight` a mano. Son 78 decisiones simples; por ejemplo, Plancha es `bodyweight` y `tracksWeight: false`, y Correr es `cardio` y `tracksWeight: false`.
- [ ] **Step 2: Sinónimos.** Agregar al menos 2 alias por ejercicio, en español y en inglés. Ejemplos: Press banca → "bench press", "pecho plano"; Jalón al pecho → "lat pulldown", "polea al pecho"; Dominadas → "pull up", "barra". Para los 28 ejercicios cuyo nombre ya está en inglés ("Hip Thrust", "Face Pull"…), agregar el alias en español ("empuje de cadera", "jalón a la cara").
- [ ] **Step 3: Borradores de texto.**

`scripts/exercises/draft-content.ts` recorre las entradas con `description` vacía y genera la descripción y los pasos con la API de Claude (modelo `claude-sonnet-5-5`, SDK `@anthropic-ai/sdk` como devDependency, `ANTHROPIC_API_KEY` del entorno). Escribe el resultado en el JSON dejando `reviewed: false`.

El prompt pide:
- tono es-AR con "vos", entre 3 y 6 pasos;
- un "error común" como último paso, con el formato "Evitá: …";
- **no** inventar datos médicos.

Si no hay API key, el script termina con un mensaje explicando cómo correrlo. Esto **no** bloquea el resto de la tarea: los textos se pueden completar a mano.

- [ ] **Step 4: Imágenes del dataset abierto.**
  1. **Verificar la licencia.** Antes de usarlo, leer el `LICENSE` del repo `yuhonas/free-exercise-db`. Si no es de dominio público o una licencia permisiva compatible, **frenar y avisar al orquestador**: en ese caso se usa `media.source: "svg"` para todos.
  2. **Script.** `match-free-exercise-db.ts` descarga `dist/exercises.json` del dataset (URL pasada como argumento) y asocia ejercicios por `nameEn` o por alias en inglés normalizado. Para cada match escribe `media: { source: "free-exercise-db", path: "<ruta de la imagen 0>", license: "Unlicense" }`. **No** descarga imágenes al repo: se suben a R2 con el script de W1-5 cuando esté disponible. Mientras tanto, `mediaUrl` apunta a la URL raw del dataset, que es pública.
- [ ] **Step 5: Fallback SVG.** Para los ejercicios sin match, `media.source: "svg"`. La UI muestra un ícono por grupo muscular principal (Task 4).
- [ ] **Step 6: Validación**

`catalog-data.test.ts` carga el JSON y verifica:
- todas las entradas pasan el schema de Zod;
- `slug` y `name` son únicos;
- los porcentajes musculares suman 100;
- los slugs de músculos existen en `prisma/seed/muscles.ts`;
- hay al menos 2 alias por ejercicio;
- **las entradas con `reviewed: true` tienen descripción y al menos 3 pasos.**

- [ ] **Step 7: Seed**

`prisma/seed/exercises.ts` lee el JSON y hace upsert por `slug` con `name`, `nameEn`, `equipment`, `measureType`, `tracksWeight`, `description` (solo si `reviewed`, si no queda en `null`), `instructions` (ídem) y `mediaUrl`. Después reemplaza los `ExerciseAlias` (los normaliza con `normalize()`) y el mapeo muscular.

Run: `npm test && npm run seed && npm run seed`. Expected: PASS e idempotente.

- [ ] **Step 8: Commit**

```bash
git add prisma/seed scripts/exercises src/features/exercises package.json package-lock.json
git commit -m "feat(exercises): rich catalog data with aliases, equipment and media sources"
```

> **Revisión humana:** al terminar la tarea, el orquestador le pasa al dueño del producto la lista de ejercicios con textos en borrador (`reviewed: false`) para que los revise. Marcar `reviewed: true` es parte de W3 si no se hizo antes.

---

### Task 3: Servidor: query de catálogo + crear ejercicio propio

**Files:**
- Create: `src/server/exercises/catalog.ts`
- Create: `src/schemas/exercise.ts` (reemplaza el existente)
- Create: `src/server/actions/exercises.ts`
- Delete: `app/api/exercise/**`, `app/api/muscle/list/route.ts` (después de migrar sus consumidores en W2-1; ver la nota en Step 4)
- Test: `src/server/exercises/catalog.int.test.ts`
- Test: `src/server/actions/exercises.int.test.ts`

**Interfaces:**
- Produce:

```ts
export async function getExerciseCatalog(userId: string): Promise<{ exercises: CatalogEntry[]; muscles: { id: string; slug: string; name: string; groupKey: string }[] }>;
export async function getExerciseDetail(exerciseId: string): Promise<{ id: string; name: string; nameEn: string | null; description: string | null; instructions: string[]; mediaUrl: string | null; equipment: Equipment; muscles: { name: string; groupKey: string; percentage: number }[] } | null>;
// actions ("use server")
export async function getExerciseCatalogAction(): Promise<ActionResult<Awaited<ReturnType<typeof getExerciseCatalog>>>>;
export async function getExerciseDetailAction(exerciseId: string): Promise<ActionResult<NonNullable<Awaited<ReturnType<typeof getExerciseDetail>>>>>;
export async function createExerciseAction(input: CreateExerciseInput): Promise<ActionResult<{ exercise: CatalogEntry }>>;
// CreateExerciseInput = { name (2..100), measureType: "reps"|"duration", equipment, tracksWeight, muscles: {muscleId, percentage 1..100}[] (suma 100, ≥1) }
```

Reglas:
- El catálogo incluye los ejercicios oficiales (`createdByUserId = null`) más los del usuario (`isMine: true`). Los ejercicios de otros usuarios **no** aparecen.
- `primaryGroupKey` es el `groupKey` del músculo con mayor porcentaje.
- Crear un ejercicio con un nombre que ya existe (comparación normalizada) da el error "Ya existe un ejercicio con ese nombre: <nombre existente>", y la respuesta incluye el `id` existente, para que la UI ofrezca usarlo. **No** hay race de 500: se captura P2002.
- El `slug` se genera a partir del nombre, y si choca se agrega un sufijo `-2`, `-3`…

- [ ] **Step 1:** tests de integración:
  - el catálogo excluye los ejercicios de otro usuario;
  - crear con `measureType: "duration"` persiste el tipo (cubre el ítem "crear ejercicio no te deja elegir por tiempo");
  - un nombre duplicado con acento distinto ("Jalon al pecho") da error y devuelve el id existente;
  - porcentajes que suman 90 dan error de validación en español.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** correr `npm run test:int -- src/server/exercises src/server/actions/exercises` hasta PASS.
- [ ] **Step 4:** **No** borrar `app/api/exercise/**` todavía, porque los formularios viejos lo usan hasta W2-1. Dejar el comentario `// TODO(W2-1): borrar cuando RoutineForm/CreateActivityForm migren a ExercisePicker` en los route handlers. W2-1 los borra.
- [ ] **Step 5: Commit**

```bash
git add src/server/exercises src/schemas/exercise.ts src/server/actions/exercises.ts app/api/exercise
git commit -m "feat(exercises): catalog query and create-exercise action with duration support"
```

---

### Task 4: Componentes: `ExercisePicker`, `ExerciseInfoButton`, `CreateExerciseSheet`

**Files:**
- Create: `src/features/exercises/useExerciseCatalog.ts`
- Create: `src/features/exercises/recent.ts` (recientes en `localStorage`, con try/catch)
- Create: `src/features/exercises/ExercisePicker.tsx`
- Create: `src/features/exercises/ExerciseRow.tsx`
- Create: `src/features/exercises/ExerciseInfoButton.tsx`
- Create: `src/features/exercises/ExerciseThumb.tsx` (imagen o ícono SVG por grupo muscular)
- Create: `src/features/exercises/CreateExerciseSheet.tsx`
- Create: `src/features/exercises/MuscleShareEditor.tsx`
- Create: `src/features/exercises/index.ts`
- Test: `src/features/exercises/recent.test.ts`, `src/features/exercises/muscle-share.test.ts` (lógica pura del editor: suma, reparto, validación)

**Interfaces:**
- Produce §5.7 exactamente, más `CreateExerciseSheet({ open, onClose, initialName?, onCreated(ex: CatalogEntry) })`.

**Comportamiento de `ExercisePicker`** (inspirado en Strong):
- Es un `Sheet` a pantalla casi completa: `max-h-[90dvh]` en mobile.
- Arriba hay un input de búsqueda con autofocus y botón ✕ para limpiar. Debajo, una fila de `Chip` de grupo muscular con scroll horizontal (Todos, Pecho, Espalda, Piernas, Hombros, Brazos, Core) y otra de equipamiento (Todos, Barra, Mancuernas, Máquina, Polea, Peso corporal, Cardio).
- Si la query está vacía y no hay filtros, se muestra primero la sección **"Recientes"**, con los últimos 8 ejercicios usados (`recent.ts`), y después "Todos" en orden alfabético con encabezados por letra.
- Cada `ExerciseRow` muestra la miniatura, el nombre, el equipamiento y el grupo principal en gris, y un `ExerciseInfoButton` a la derecha.
  - Al tocar la fila se selecciona: aparece un check y `bg-surface-2`.
  - Con `multiple`, los seleccionados se acumulan y aparece un footer fijo **"Agregar (N)"** como `Button` primario `fullWidth`.
  - Sin `multiple`, tocar una fila confirma directamente.
- Si no hay resultados, se muestra el `EmptyState` "No encontramos «<query>»" con el botón **"+ Crear «<query>»"**, que abre `CreateExerciseSheet` con `initialName`.
- Al confirmar, se llama a `recent.push(ids)` y a `onConfirm(selected)`.
- **Rendimiento:** la lista se renderiza completa (son menos de 200 ítems). La búsqueda usa `useDeferredValue`.

**Comportamiento de `ExerciseInfoButton`:**
- Es un botón "?" circular de 28 px con `aria-label="Cómo se hace <nombre>"`.
- Abre un `Sheet` con:
  - la imagen (si hay `mediaUrl`, `<img>` con `object-contain` y fondo `bg-surface-2`) o el ícono SVG;
  - la descripción, los pasos numerados y los músculos trabajados con `ProgressBar` por porcentaje.
- Carga el detalle con `getExerciseDetailAction` y lo cachea en memoria por id.
- Si el ejercicio no tiene descripción revisada, muestra: "Todavía no tenemos la explicación de este ejercicio."

**Comportamiento de `CreateExerciseSheet`:**
- Tiene los campos nombre, **"Se mide por"** (segmentado: Repeticiones / Tiempo), equipamiento (`Select`), "¿Usa peso?" (`Switch`, que en Tiempo arranca en no) y músculos.
- **`MuscleShareEditor`:**
  - Al agregar un músculo, el editor reparte los porcentajes en partes iguales (con 2 músculos, 50/50).
  - El usuario ajusta cada uno con un `Slider` de 5 en 5. Se muestra la suma en tiempo real y, si no da 100, un botón "Ajustar a 100" que normaliza proporcionalmente.
  - **Se colapsa automáticamente** a un resumen ("Pecho 60 % · Tríceps 40 % ✎") cuando el usuario confirma los músculos o cuando el foco pasa a otro campo. Se reabre tocando el resumen. Esto cubre el ítem "lista de músculos ocultable automáticamente".
- Al guardar se usa `createExerciseAction` con `<Button pending>` y `toastResult`.
  - Si el nombre está duplicado, se muestra el error con un botón "Usar «<existente>»".
  - Si sale bien, se llama a `onCreated(ex)` y se invalida el catálogo (`refresh()`).

- [ ] **Step 1:** tests puros:
  - `recent.ts`: dedup, máximo 8, orden y tolerancia a un `localStorage` que tira error;
  - lógica de `MuscleShareEditor` (`splitEvenly(n)`, `normalizeTo100(values)`, `isValid`) extraída a `muscle-share.ts`.
- [ ] **Step 2:** implementar los componentes con las primitivas de W0-B (sin hex).
- [ ] **Step 3: Catálogo `/dev/ui`.** Agregar la sección `app/dev/ui/sections/exercises.tsx` con:
  - el picker en modo simple y en modo múltiple, mostrando el resultado en un toast;
  - un `ExerciseInfoButton` para "Press banca";
  - un botón que abre `CreateExerciseSheet`.
- [ ] **Step 4: Verificación manual (375 px)**
  - Buscar "triceps", "bench", "sentadila" y "jalon".
  - Filtrar por Piernas + Barra.
  - Crear el ejercicio "Plancha lateral" por tiempo y verificar que aparece en el picker como propio.
  - Verificar que el editor de músculos se colapsa al confirmar.
  - Abrir el "?" de Press banca.
- [ ] **Step 5: Commit**

```bash
git add src/features/exercises app/dev/ui/sections
git commit -m "feat(exercises): Strong-like exercise picker, info dialog and create-exercise sheet"
```

---

### Verificación final de W1-3
- [ ] Gates verdes.
- [ ] Hay screenshots del picker en 375 px.
- [ ] Hay una lista de ejercicios con `reviewed: false` para la revisión humana.
- [ ] Pedir review y merge a `rework/v2`.
