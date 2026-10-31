# El Bravo

App para entrenar en grupo: registrás tus entrenamientos (tipo Strong: ejercicios, series, pesos y tiempos), tus amigos los ven y compiten en **temporadas** por constancia y tiempo entrenado. Las insignias son logros personales. Es mobile-first, solo en modo oscuro, y se instala en el celular como PWA.

- **Puntos (D1):** cada día entrenado suma 10 pts por presentarte, más puntos por el tiempo, que crecen cada vez más despacio (30 min = 20 pts, 1 h = 26, 2 h = 33). Varias actividades el mismo día se suman al tiempo del día. Además, +20 por cumplir los días de la semana y +5 extra por cada semana seguida de racha (hasta +25).
- **Plan y decisiones:** [`docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md`](docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md) (arquitectura, contratos entre módulos y decisiones D1–D13). El avance está en [`PROGRESO.md`](docs/superpowers/plans/2026-10-31-el-bravo-v2/PROGRESO.md).

## Stack

- Next.js 16 (App Router, Server Actions) y React 19.
- Tailwind 4 con tokens de `app/globals.css`.
- Prisma 7 con MySQL 8.4 (adapter mariadb) y Zod 4.
- Auth con `jose` (JWT en cookie httpOnly) y `bcryptjs`.
- Fotos en Cloudflare R2 (API S3).
- Web Push (VAPID) y email por Resend.
- Vitest y Playwright.

## Setup local

Requisitos:
- **Node ≥ 22.12**.
- **MySQL 8.4** con `lower_case_table_names=1`, que hay que configurar antes de inicializar el datadir. En macOS: `brew install mysql@8.4` y `lower_case_table_names=1` en `my.cnf`.

1. `npm ci`.
2. `cp .env.example .env` y completá `DATABASE_URL` y `JWT_SECRET` (`openssl rand -hex 32`). El usuario de MySQL necesita permiso `CREATE` global: Prisma crea una shadow DB y los E2E crean su propia DB.
3. `npx prisma generate`.
4. `npm run db:worktree -- <id> <puerto>` (ejemplo: `npm run db:worktree -- dev 3000`). Crea `elbravo_<id>` y `elbravo_<id>_test`, escribe `.env.local` (que tiene prioridad sobre `.env`), corre las migraciones y siembra el catálogo (categorías, músculos, 78 ejercicios e insignias).
5. `npm run dev` y abrí `http://localhost:<puerto>`.

Opcional:
- **Datos de demo:** `npx tsx scripts/dev/seed-group-demo.ts [--reveal manual] [--ended]` crea 3 usuarios (`ana@demo.test` / `demo1234`, etc.) con un grupo y una temporada con datos.
- **Fotos sin cuenta de Cloudflare:** MinIO local (`brew install minio`) con el bucket `elbravo-media` y las variables `R2_*` apuntando a `http://127.0.0.1:9000` (ver `R2_ENDPOINT` en `.env.example`). Para producción, ver [`docs/r2-setup.md`](docs/r2-setup.md).
- **Catálogo de componentes:** `/dev/ui`, solo en desarrollo.

Nunca uses `prisma db push`. Todo cambio de schema va en una migración (`npx prisma migrate dev --name …`).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server (puerto `$PORT`, 3000 por defecto) |
| `npm run build` / `npm start` | Build y server de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, con las guardas de v2 en modo error: `no-alert`, fechas sin zona horaria, `setHours`/`getDay`/`getDate` y `<a href>` interno |
| `npm run lint:colors` | Falla si hay colores hex fuera de `app/globals.css` / `app/layout.tsx` / `app/manifest.ts` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:int` | Tests de integración contra `DATABASE_URL_TEST` (MySQL real) |
| `npm run test:e2e` | E2E con Playwright (ver abajo) |
| `npm run seed` | Seed idempotente del catálogo |
| `npm run db:worktree -- <id> <puerto>` | DB propia por worktree (crea, migra y siembra) |

### E2E

`npm run test:e2e` hace lo siguiente:
1. Compila la app (`next build`) y la levanta con `next start` en el puerto `3031`.
2. Recrea una DB propia, `<tu db>_e2e` (por ejemplo `elbravo_dev_e2e`), con migraciones, catálogo y `e2e/fixtures/seed-e2e.ts`.
3. Corre los specs en un viewport de 375 px.

Las contraseñas de test se generan en cada corrida y quedan en `e2e/.auth/credentials.json`, que no se versiona. El spec de fotos necesita MinIO (o R2) configurado.

Variables útiles:
- `E2E_SKIP_BUILD=1`: reusa el build.
- `E2E_SKIP_SEED=1`: no recrea la DB.
- `E2E_PORT`: cambia el puerto.
- `E2E_DATABASE_URL`: usa otra DB.

El reporte HTML queda en `playwright-report/`.

## Arquitectura (resumen)

- `app/`: rutas (App Router). Las páginas son Server Components y llaman a `requirePageUser()`. Los route handlers son solo `api/cron/*` y `api/health`.
- `src/server/actions/*`: **Server Actions**, el único camino de las mutaciones. Devuelven `ActionResult` (`ok`/`fail`) a través de `runAction`, que traduce los errores de auth y Prisma a mensajes en español.
- `src/server/auth/dal.ts`: `getSession`, `requireUser`, `requireGroupMember`, `requireGroupAdmin`. Es el único lugar que lee la sesión. `proxy.ts` hace solo un chequeo optimista de la firma.
- `src/server/activities`: el único camino de escritura de actividades. Las operaciones son idempotentes por `clientRequestId` y, después de cada cambio, `runActivityEffects` recalcula los puntos (`src/server/scoring`), las insignias (`src/server/badges`) y las notificaciones (`src/server/notifications`).
- `src/lib/time`: única fuente de fechas, semanas y zonas horarias.
- `src/features/*`: UI por dominio. `src/components/ui`: primitivas (`Button` con `pending`, `toast`, `ConfirmDialog`, `Sheet`…).
- Revisión de seguridad: [`docs/security-review.md`](docs/security-review.md). Mediciones de performance: [`docs/perf.md`](docs/perf.md).

## Variables de entorno

Ver [`.env.example`](.env.example) (comentado). Resumen:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | MySQL de la app |
| `DATABASE_URL_TEST` | MySQL de los tests de integración |
| `JWT_SECRET` | Firma de la cookie de sesión (obligatoria) |
| `JWT_COOKIE_NAME` | Nombre de la cookie (por defecto `elbravo_token`) |
| `CRON_SECRET` | `Authorization: Bearer …` de `/api/cron/*`. Sin esta variable, los crons responden 401 |
| `APP_URL` | URL pública (links de emails y push) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Fotos en Cloudflare R2 |
| `R2_ENDPOINT` | Solo en desarrollo, para MinIO |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push. Sin claves, el canal queda apagado |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email. Sin clave, el canal queda apagado |
