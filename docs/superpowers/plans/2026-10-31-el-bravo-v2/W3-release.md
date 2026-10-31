# W3 — Endurecimiento, E2E, migración de producción y release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md`.

**Goal:** dejar v2 lista para producción: tests end-to-end de los flujos críticos, guardas de calidad en modo estricto, revisión de seguridad, datos de producción migrados con backup y un deploy documentado.

**Architecture:** Playwright contra el dev server con una DB `elbravo_e2e` sembrada por un script determinista. Los scripts de migración de W0-C y W1-5 corren contra una copia de producción antes de tocar la real.

**Tech Stack:** Playwright, MySQL, Vercel (cron), Cloudflare R2, Resend.

**Depende de:** las Olas 0–2 mergeadas en `rework/v2`. **Rama:** `v2/w3-release`.

---

### Task 1: E2E de flujos críticos

**Files:**
- Create: `playwright.config.ts` (proyecto `mobile`, con viewport 375×812 y user agent de iPhone, y proyecto `desktop`)
- Create: `e2e/fixtures/seed-e2e.ts` (3 usuarios con contraseñas de test generadas y guardadas en `e2e/.auth/credentials.json`, que va al `.gitignore`; un grupo, una temporada activa y rutinas)
- Create: `e2e/*.spec.ts`
- Modify: `package.json` (`"test:e2e": "playwright test"`)

Specs (cada uno corre en `mobile`):
1. `auth.spec.ts`:
   - registro;
   - logout;
   - login con `?next=`;
   - bloqueo después de 5 intentos fallidos;
   - cambio de contraseña, que cierra la otra sesión (dos contexts).
2. `log-workout.spec.ts`:
   - registrar fuerza con 2 ejercicios y 2 fotos (fixture `e2e/fixtures/photo.jpg`);
   - el resultado muestra puntos y solo las insignias afectadas;
   - el detalle muestra las series;
   - editar y borrar recalculan.
3. `live-routine.spec.ts`:
   - crear una rutina con un ejercicio por tiempo;
   - empezarla en vivo y tildar series;
   - recargar y retomar;
   - terminar y actualizar la rutina.
4. `season.spec.ts`:
   - el admin crea una temporada con sliders y premios;
   - el miembro se une;
   - con 3 entrenamientos por semana, el ranking cuadra con D1;
   - editar el objetivo recalcula;
   - finalizar en modo manual: el miembro ve la espera, el admin publica y se ven podio y premios.
5. `social.spec.ts`:
   - seguir y dejar de seguir;
   - perfil ajeno sin email;
   - notificación "fue el primero en arrancar la semana" en la campana del otro usuario.
6. `offline-retry.spec.ts`:
   - `context.setOffline(true)` al guardar muestra el error;
   - al reintentar online queda exactamente 1 entrenamiento.
7. `visual-smoke.spec.ts`:
   - screenshot de cada página principal en 375 px;
   - assert de que no hay scroll horizontal: `document.documentElement.scrollWidth <= innerWidth`.

- [ ] **Step 1:** instalar `npm i -D @playwright/test && npx playwright install chromium webkit`.
- [ ] **Step 2:** escribir los specs uno por uno, corriéndolos a medida que se escriben.
- [ ] **Step 3: Commit**

```bash
git add -A e2e playwright.config.ts package.json package-lock.json .gitignore
git commit -m "test(e2e): critical flows on mobile viewport"
```

### Task 2: Guardas estrictas y limpieza

- [ ] Pasar `no-alert` y `no-restricted-syntax` (fechas) a `error`. Dejar `npm run lint` sin errores, incluidos los `no-explicit-any` heredados que sigan vivos.
- [ ] Dejar `scripts/color-baseline.json` en `{}` (sin hex fuera de `globals.css` y `layout.tsx`).
- [ ] `grep -rn "app/api" app` → solo debe haber `cron/*`, `health` y nada más. Borrar todo lo que quede.
- [ ] Borrar `src/lib/currentUser.ts` (deprecated) y actualizar sus imports.
- [ ] Revisar `README.md`: qué es El Bravo, setup local (Node 22, MySQL con `lower_case_table_names=1`, `npm run db:worktree`), scripts, arquitectura (enlace a `00-roadmap.md`) y variables de entorno.
- [ ] Commit: `chore: strict lint guards, remove legacy API and update README`.

### Task 3: Revisión de seguridad y performance

- [ ] Correr el skill `security-review` sobre `rework/v2` vs `main` y resolver los hallazgos.
- [ ] Revisar que **toda** Server Action llame a `requireUser`/`requireGroup*`. Para eso, escribir un test que importe cada módulo de `src/server/actions/*`, llame a cada export sin sesión (`getSession` mockeado a `null`) y espere `ok: false` con "Tenés que iniciar sesión.".
- [ ] Índices: con el seed demo de 3 temporadas × 10 usuarios × 200 actividades, `recomputeSeason` tiene que tardar < 300 ms y la página de grupo < 500 ms en el servidor. Medirlo y documentarlo en `docs/perf.md`. Si algo no cumple, agregar índices: es la única migración permitida en W3.
- [ ] Commit: `test: action auth coverage; docs: perf baseline`.

### Task 4: Migración de producción y deploy

**Depende de la decisión abierta 6 (`00-roadmap.md` §8).**

- [ ] **Inventario.** Confirmar con el dueño del producto dónde corre producción (Vercel + qué MySQL) y conseguir acceso de lectura para el backup.
- [ ] **Backup.** Correr `mysqldump --single-transaction --routines` de producción → `backups/prod-<fecha>.sql` (fuera del repo) y verificar que restaura en local.
- [ ] **Ensayo en local:**
  1. Restaurar el backup en `elbravo_prodcopy` (con `lower_case_table_names=1`).
  2. `npx prisma migrate deploy` + `npx tsx scripts/migrate-v2-data.ts`.
  3. `npx tsx scripts/migrate-images-to-r2.ts --dry-run`, revisando el CSV.
  4. Corrida real de imágenes contra un bucket **de staging**.
  5. Revisar a mano con la app apuntando a la copia: 3 usuarios reales, sus grupos, temporadas y entrenamientos, y que los puntos recalculados tengan sentido. Anotar las diferencias contra v1 en `docs/migration-report.md`, porque los puntos cambian a propósito por D1.
- [ ] **Comunicación.** Redactar un mensaje corto para los usuarios explicando el sistema de puntos nuevo (texto de D1) y que los puntajes de temporadas pasadas se recalcularon. **Lo envía el dueño del producto, no el agente.**
- [ ] **Configurar el entorno de producción.** Lo hace el dueño del producto, guiado: `DATABASE_URL`, `JWT_SECRET` (rotarlo invalida las sesiones; elegir si se quiere), las variables `R2_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` y `CRON_SECRET`. Para eso, crear `vercel.json` con los crons:

```json
{ "crons": [
  { "path": "/api/cron/seasons", "schedule": "15 3 * * *" },
  { "path": "/api/cron/notifications", "schedule": "*/15 * * * *" }
] }
```

(Vercel manda `Authorization: Bearer $CRON_SECRET` automáticamente si `CRON_SECRET` está definido.)
- [ ] **Release:**
  1. Ventana de mantenimiento.
  2. Backup final.
  3. Merge `rework/v2` → `main` (PR con el resumen y el link al roadmap).
  4. Deploy.
  5. `prisma migrate deploy` + `migrate-v2-data.ts` + migración de imágenes contra producción.
  6. Smoke manual en el celular.
- [ ] **Plan de rollback:** restaurar el backup y redeployar el último commit de v1 (`ab1df60`). Documentarlo en `docs/release-v2.md`.
- [ ] **Revisión humana pendiente:** textos de ejercicios con `reviewed: false` (W1-3). Abrir un issue con la lista.
