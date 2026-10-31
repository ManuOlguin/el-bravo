# W2-2 — Grupo y experiencia de temporada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D1, D3, §4, §5.5, §6.2–6.3).

**Goal:** rehacer la página de grupo (hoy 650 + 760 líneas mezclando datos y UI) y la experiencia de temporada:
- **Wizard de creación:** con sliders por tipo de actividad, elección de premios y modo de publicación de resultados (auto/manual).
- **Durante la temporada:** ranking en vivo con explicación de puntos.
- **Al terminar:** una pantalla final con podio, tabla de ranking final, premios y stats.

**Architecture:**
- **Server Components** para los datos: `getGroupPageData` arma un DTO tipado y sin datos sensibles.
- **Islas cliente** solo para la interacción: acciones, sliders y calendario.
- **Mutaciones:** todas pasan por las acciones de W1-1 (temporadas) y W1-4 (grupos).

**Tech Stack:** Next 16 RSC, Server Actions, primitivas UI, `Avatar href` → `/u/[id]`.

**Spec:** `00-roadmap.md`. **Depende de:** W1-1, W1-4 (y W1-2 y W1-5 para insignias y foto de grupo). **Rama:** `v2/w2-2-group`. Puerto 3022.

## Global Constraints
Ver `00-roadmap.md` §4.

---

### Task 1: Datos de la página de grupo (DTO)

**Files:**
- Create: `src/features/group/data.ts` (`getGroupPageData(groupId, viewer)`)
- Test: `src/features/group/data.int.test.ts`

**Interfaces:**
- Produce:

```ts
export type GroupPageData = {
  group: GroupDTO; // de W1-4
  viewer: { id: string; role: "admin" | "member"; timezone: string };
  current: SeasonSummary | null;    // active, o ended sin publicar
  upcoming: SeasonSummary | null;
  past: SeasonSummary[];            // finalized, más recientes primero
  standings: StandingRow[];         // de `current` (vacío si no hay)
  myWeek: { weekKey: string; workouts: number; target: number; days: { date: string; count: number }[] } | null; // en tz del grupo
  feed: { id: string; user: { id: string; name: string | null; photoUrl: string | null }; categoryName: string; startedAt: Date; durationMinutes: number; points: number | null; photoUrl: string | null }[]; // últimas 20 de miembros, paginable con cursor
};
export type SeasonSummary = { id: string; name: string; startDate: string; endDate: string; status: SeasonStatus; resultsReveal: "auto" | "manual"; resultsPublished: boolean; joined: boolean; memberCount: number; weeklyGoal: number; categories: { id: string; name: string; weight: number }[]; awards: { awardType: SeasonAwardType; bonusPoints: number }[] };
```

Reglas:
- Antes de leer, llama a `ensureSeasonFinalizedIfDue` para la temporada `current` (W1-1).
- El `feed` incluye los puntos de cada actividad en la temporada actual (`getActivityPoints`).
- **Sin `take` arbitrarios** que trunquen las estadísticas: las stats salen de `SeasonStanding`.

- [ ] **Step 1:** tests:
  - el DTO no contiene `inviteCode` ni `email` (`JSON.stringify` no los incluye);
  - los estados de temporada se clasifican bien;
  - `myWeek` usa la zona horaria del grupo.
- [ ] **Step 2:** implementar.
- [ ] **Step 3: Commit**

```bash
git add src/features/group/data.ts src/features/group/data.int.test.ts
git commit -m "feat(group): typed group page data without sensitive fields"
```

---

### Task 2: Página de grupo

**Files:**
- Rewrite: `app/group/[id]/page.tsx` (Server Component chico que compone secciones)
- Delete: `app/group/[id]/GroupPageClient.tsx` y los componentes `Group*`, `UserActiveStats`, `GroupUserCalendar`, `InviteGroupButton`, `GroupInviteCodePanel`, `GroupSettingsPopup`, `JoinGroupModal`, `LeaveGroupButton`, `DeleteGroupButton`, `EditGroupForm`, `KickMemberButton` y `DeleteSeasonButton` de `src/components/`, reemplazados por los de abajo
- Create en `src/features/group/`:
  - `GroupHeader.tsx`: foto, nombre, cantidad de miembros, botón "Invitar" (abre `InviteSheet`) y ⚙️ (solo admin → `/group/[id]/settings`)
  - `InviteSheet.tsx`: código grande, botones "Copiar" y "Compartir" (`navigator.share`, con fallback a copiar) y "Regenerar" (admin)
  - `SeasonHero.tsx`: temporada actual con nombre, fechas, "Faltan N días", tu posición y puntos, y CTA según estado ("Unirme a la temporada" / "Ver resultados")
  - `MyWeekCard.tsx`: semana actual con 7 puntos (lun–dom) marcados y "2/3 esta semana"
  - `Leaderboard.tsx`: tabla de `StandingRow` con posición (🥇🥈🥉), avatar (link), nombre, puntos, semanas cumplidas y racha 🔥. La fila del viewer va resaltada. Tiene un botón "¿Cómo se suman los puntos?" que abre `PointsRulesSheet`
  - `PointsRulesSheet.tsx`: las reglas de D1 en lenguaje simple, con los valores **de esa temporada** (incluye los pesos por actividad)
  - `ActivityFeed.tsx`: feed del grupo con "Cargar más"; cada ítem muestra avatar, nombre, actividad, duración, "+N pts" y la foto
  - `MembersList.tsx`: miembros con rol. El admin tiene un menú ⋯ con "Hacer admin", "Quitar admin" y "Expulsar" (`useConfirm`)
  - `PastSeasons.tsx`: lista de temporadas pasadas con ganador y link a resultados
  - `GroupActionsMenu.tsx`: "Salir del grupo" y, para admin, "Borrar grupo"
- Create: `app/group/[id]/settings/page.tsx`: nombre, descripción, foto (`PhotoUploader target={{kind:"group"}}`), zona horaria y zona de peligro
- Create: `app/groups/page.tsx` (lista de mis grupos + "Unirme con código" + "Crear grupo") y `app/groups/new/page.tsx` (formulario simple, que reemplaza el wizard de 351 líneas de `create-group`)
- Delete: `app/create-group/**`, `app/group/page.tsx`, `app/group/edit/**`, `app/group/[id]/edit/**`, `app/dashboard/**`
- Modify: `next.config.ts` (redirects `/create-group` → `/groups/new`, `/group` → `/groups`, `/dashboard` → `/home`, `/group/:id/edit` → `/group/:id/settings`)
- Modify: `src/components/shell/nav-items.ts` (`groups.enabled = true`)

**Orden de la página en mobile:** `GroupHeader`, `SeasonHero`, `MyWeekCard`, `Leaderboard`, `ActivityFeed`, `PastSeasons` y `MembersList`. En desktop: 2 columnas (ranking + semana a la izquierda; feed a la derecha).

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** verificar con 3 usuarios y datos sembrados (crear `scripts/dev/seed-group-demo.ts`: 3 usuarios, 1 grupo, una temporada activa y 3 semanas de entrenamientos variados):
  - el ranking coincide con el cálculo manual de D1;
  - el feed pagina;
  - la invitación por "Compartir" funciona en mobile;
  - expulsar saca al miembro del ranking.
- [ ] **Step 3: Commit**

```bash
git add -A app/group app/groups app/create-group app/dashboard src/features/group src/components next.config.ts scripts/dev
git commit -m "feat(group): rebuilt group page with leaderboard, feed and settings"
```

---

### Task 3: Wizard de temporada (crear/editar) con sliders y premios

**Files:**
- Create: `app/group/[id]/season/new/page.tsx`, `app/group/[id]/season/[seasonId]/edit/page.tsx`
- Create: `src/features/season/SeasonForm.tsx` (+ `season-form-state.ts` puro, con test)
- Create: `src/features/season/CategoryWeightsEditor.tsx`
- Create: `src/features/season/AwardsPicker.tsx`
- Delete: `app/group/[id]/create-season/**`, `src/components/EditSeasonForm.tsx`
- Test: `src/features/season/season-form-state.test.ts`

**Formulario** (una página con secciones; en mobile, pasos con `Tabs` "Básico · Actividades · Premios · Reglas"):
1. **Básico:**
   - nombre;
   - fechas de inicio y fin (`<input type="date">`), con validación de que no se superpongan (el error de la acción se muestra en el campo);
   - objetivo semanal (1–7) y duración mínima (por defecto 20 min);
   - **"Resultados al terminar"**: un segmentado *Automático* / *Lo decide el admin*.
2. **Actividades** (cubre "sliders por tipo de actividad"):
   - una lista de todas las categorías, cada una con un `Switch` (cuenta / no cuenta) y, si cuenta, un `Slider` de 0,25 a 2 en pasos de 0,25, con la etiqueta "×1,5 → 15 pts por entrenamiento";
   - presets arriba: "Todo vale igual", "Solo gimnasio" y "Más puntos al cardio".
3. **Premios** (cubre "el admin decide qué premios hay"):
   - `SEASON_AWARD_INFO` como tarjetas seleccionables (ícono, nombre y descripción), cada una con un `NumberInput` opcional de "puntos extra" (por defecto 0);
   - preseleccionados: "El más constante" y "Racha más larga".
4. **Reglas (avanzado, colapsado):** puntos por entrenamiento, umbral y bonus de sesión larga, bonus semanal y paso y tope de racha, con los valores de D1 por defecto y el texto "Si no sabés, dejalo así".

El resumen fijo al pie dice: "Un entrenamiento de 45 min de Fuerza = 10 pts · Semana cumplida = +20". Se recalcula en vivo con `computeSeasonScores` sobre un ejemplo, importando la función pura.

Al editar una temporada activa se muestra el aviso "Al guardar se recalculan los puntos de todos". Las temporadas `finalized` no se editan: se ofrece "Reabrir temporada" (admin, con `useConfirm danger`).

- [ ] **Step 1:** test del estado puro: presets, validación y conversión a `SeasonInput`.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** verificar:
  - crear una temporada con running ×2 y fuerza ×1: un running de 30 min suma 20 pts;
  - editar el objetivo de 3 a 2: el ranking cambia;
  - intentar superponer fechas: el error aparece en el campo.
- [ ] **Step 4: Commit**

```bash
git add -A app/group src/features/season src/components/EditSeasonForm.tsx
git commit -m "feat(season): season wizard with category weight sliders, awards and reveal mode"
```

---

### Task 4: Pantalla de temporada y final de temporada

**Files:**
- Create: `app/group/[id]/season/[seasonId]/page.tsx`
- Create: `src/features/season/SeasonResults.tsx` (finalizada y publicada)
- Create: `src/features/season/SeasonLive.tsx` (activa: ranking completo, semanas por usuario y reglas)
- Create: `src/features/season/Podium.tsx`
- Create: `src/features/season/FinalStandingsTable.tsx`
- Create: `src/features/season/AwardsShowcase.tsx`
- Create: `src/features/season/SeasonStats.tsx`
- Create: `src/features/season/ResultsPendingCard.tsx`
- Create: `src/features/season/data.ts` (`getSeasonPageData(seasonId, viewer)`: standings, ganadores de premios y stats agregadas)

**Pantalla según estado:**
- **`upcoming`:** reglas, categorías con pesos, premios en juego, "Empieza en N días" y botón "Unirme".
- **`active`:** `SeasonLive` con el ranking completo y, para cada usuario, una mini-grilla de semanas (✓ cumplida, · en curso, ✗ no cumplida), más las reglas.
- **`ended` sin publicar (`resultsReveal: manual`):** los miembros ven `ResultsPendingCard` ("La temporada terminó. Esperando que <admin> publique los resultados 🥁"). El admin ve una vista previa de los resultados y el botón **"Publicar resultados"** (`publishSeasonResultsAction`), que dispara la notificación `season_results_published` (W2-3).
- **`finalized` + publicada:** `SeasonResults` (cubre "pantalla de finalización" y "tabla de ranking final"):
  1. **Podio** animado, con los 3 primeros sobre pedestales 1/2/3 en oro, plata y bronce, cada uno con avatar, nombre y puntos.
  2. **Premios:** `AwardsShowcase` muestra una tarjeta por premio con ícono, ganador(es), valor ("14 entrenamientos") y "+N pts" si corresponde.
  3. **Tabla final:** `FinalStandingsTable` lista a todos con puesto, puntos, entrenamientos, semanas cumplidas, mejor racha y minutos. Se ordena por columna y la fila del viewer va resaltada.
  4. **Stats de la temporada:** entrenamientos totales del grupo, horas totales, actividad más popular, día de la semana más activo y mejor semana del grupo.
  5. **"Tus números":** tu puesto, tus puntos, tu mejor racha y comparación con el promedio.
- **Primera vez que el usuario abre una temporada recién publicada:** se muestra la vista "reveal". Primero se revelan los premios uno por uno al tocar y después el podio. Se recuerda en `localStorage` (`season-revealed:<id>`) y se puede saltear.

- [ ] **Step 1:** implementar `data.ts` con un test de integración de las stats agregadas.
- [ ] **Step 2:** implementar la UI.
- [ ] **Step 3:** verificar con el script demo:
  - forzar el fin moviendo la `endDate` al pasado vía Prisma Studio y abrir la página: en modo `auto` se ve la vista reveal;
  - en modo `manual`, el miembro ve la espera y el admin publica;
  - después de publicar, el miembro ve los resultados.
- [ ] **Step 4: Commit**

```bash
git add app/group src/features/season
git commit -m "feat(season): live season view and end-of-season results with podium, awards and stats"
```

---

### Verificación final de W2-2
- [ ] Ítems cubiertos: 2 (UI de recálculo), 12, 29 y 32.
- [ ] `lint:colors` sin hex en `src/features/{group,season}` ni en `app/group*`.
- [ ] Pedir review y merge.
