# W3 — Endurecimiento, E2E, migración de producción y release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md`.

**Goal:** dejar v2 lista para producción: tests end-to-end de los flujos críticos, guardas de calidad en modo estricto, revisión de seguridad, una base de datos de producción nueva en un hosting que no se borre por inactividad y un deploy documentado (web + PWA).

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

### Task 4: Base de datos de producción y deploy (D13: empezar de cero)

**Depende de la decisión D13 (`00-roadmap.md` §3 y §8).** El escenario esperado es que la DB vieja de Aiven (`el-bravo-prod-sql`) ya esté borrada y v2 arranque con una base nueva.

- [ ] **Confirmar el estado de la DB vieja (lo hace el dueño del producto en la consola de Aiven, proyecto `leojmelman-6905`):**
  - Si `el-bravo-prod-sql` ya no existe y `el-bravo-prod` no es una DB MySQL con datos de El Bravo, se arranca de cero y se saltea el paso siguiente.
  - Si hay datos, se exporta un backup con `mysqldump --single-transaction` → `backups/prod-<fecha>.sql` (fuera del repo). Se ensaya en local: restaurar en `elbravo_prodcopy` (con `lower_case_table_names=1`), `prisma migrate deploy`, `scripts/migrate-v2-data.ts` y `scripts/migrate-images-to-r2.ts --dry-run`. El resultado se documenta en `docs/migration-report.md`.
- [ ] **Elegir el hosting de la DB.** Comparar al menos dos opciones según:
  - que **no se borre ni se apague por inactividad**;
  - compatibilidad con MySQL 8 y con Prisma (adapter mariadb o mysql);
  - plan gratis o costo mensual;
  - backups;
  - región cercana a Sudamérica o a la región de Vercel.

  Candidatas: TiDB Cloud Starter (compatible con MySQL, plan gratis) y Aiven con un plan pago chico. Verificar las condiciones vigentes en la web de cada proveedor y documentar la elección en `docs/release-v2.md`. **La elección final la confirma el dueño del producto.**
- [ ] **Verificar la sensibilidad a mayúsculas del hosting elegido:**
  - Correr `prisma migrate deploy` desde cero sobre la DB nueva vacía.
  - Correr `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` y verificar que da vacío.
  - Si las migraciones viejas fallan por nombres de tabla en minúscula (`lower_case_table_names=0`), **squashear** todas las migraciones en una sola baseline `0_v2_baseline`. Para eso: `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, mover las migraciones viejas a `prisma/migrations-legacy/` y documentarlo. Es seguro porque producción arranca vacía. Las DBs locales de desarrollo se recrean con `npm run db:worktree`.
- [ ] **Sembrar producción** con `npm run seed` (categorías, músculos, ejercicios e insignias), apuntando a la DB nueva desde una máquina de confianza.
- [ ] **Configurar el entorno de producción en Vercel.** Lo hace el dueño del producto, guiado:
  - `DATABASE_URL`, `JWT_SECRET` (nuevo), `APP_URL`, `CRON_SECRET`;
  - las variables `R2_*` (D8);
  - `VAPID_*` (push);
  - `RESEND_API_KEY` y `EMAIL_FROM`, solo cuando haya dominio (D9).

  Crear `vercel.json` con los crons:

```json
{ "crons": [
  { "path": "/api/cron/seasons", "schedule": "15 3 * * *" },
  { "path": "/api/cron/notifications", "schedule": "*/15 * * * *" }
] }
```

(Vercel manda `Authorization: Bearer $CRON_SECRET` automáticamente si `CRON_SECRET` está definido. **Verificar si el plan de Vercel permite crons cada 15 minutos.** Si el plan gratis solo permite crons diarios, el envío de push ya es inmediato después de `notify` (W2-3) y el cron queda como reintento diario: ajustar el schedule y documentarlo.)
- [ ] **Comunicación.** Redactar un mensaje corto para el grupo de amigos: qué es v2, cómo instalarla en el celular (PWA ahora; APK cuando esté W4), el sistema de puntos nuevo (texto de D1) y que hay que crear la cuenta de nuevo si la DB arranca vacía. **Lo envía el dueño del producto, no el agente.**
- [ ] **Release:**
  1. Merge `rework/v2` → `main` (PR con el resumen y el link al roadmap).
  2. Deploy.
  3. Smoke manual en el celular: registro, instalación como PWA, crear un grupo, registrar un entrenamiento con foto, activar push.
- [ ] **Plan de rollback:** si algo falla, se redeploya el commit anterior. Con la DB nueva no hay datos viejos que restaurar. Documentarlo en `docs/release-v2.md`.
- [ ] **Revisión humana pendiente:** textos de ejercicios con `reviewed: false` (W1-3). Abrir un issue con la lista.
