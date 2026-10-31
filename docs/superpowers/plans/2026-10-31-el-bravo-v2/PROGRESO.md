# Progreso de la ejecución (noche del 31-oct-2026)

Registro del orquestador. Cada ola se ejecuta con subagentes en worktrees separados; al terminar, el orquestador revisa, mergea a `rework/v2` y corre los gates.

| Ola | Workstream | Estado | Rama | Notas |
|---|---|---|---|---|
| 0a | W0-A Base técnica | ✅ mergeado | `v2/w0-a-base` | 6 commits; typecheck, tests (38 unit + 1 int), build y colores OK. Lint: quedan 55 errores heredados (`no-explicit-any`) que se van con las reescrituras |
| 0a | W0-B Base UI + PWA | ✅ mergeado | `v2/w0-b-ui` | 6 commits: tokens + Montserrat, Button con pending, toasts/modal/sheet/confirm, primitivas, shell con bottom nav, PWA. Verificado en navegador: sin scroll horizontal a 375 px y fondo oscuro aunque el celular esté en modo claro |
| 0b | W0-C Schema v2 | ✅ mergeado | `v2/w0-c-schema` | 5 commits: schema v2 completo en una migración, migración de datos v1→v2 probada con fixture, seed modular, servicio único de actividades (idempotente, transaccional, hora local→UTC), puente para que las pantallas viejas funcionen. 43 unit + 16 integración OK |
| 1 | W1-1 Puntos · W1-2 Insignias · W1-3 Ejercicios · W1-4 Social · W1-5 Fotos | ✅ mergeados | `v2/w1-*` | ver bitácora |
| 2 | W2-1 Entrenamientos · W2-2 Grupo/Temporadas · W2-3 Notificaciones · W2-4 Home/Perfil/Stats | ✅ mergeados | `v2/w2-*` | ver bitácora |
| 3 | W3 Release | ✅ Tasks 1–3 mergeadas (E2E, guardas, seguridad/perf). ⏸️ Task 4 (producción) espera por vos | `v2/w3-hardening` | ver bitácora |
| 4 | W4 App móvil | no se ejecuta sin vos (Firebase, Android Studio) | | |

## Bitácora
- 31-oct: arranca la Ola 0a.
- W0-A terminado y mergeado. Desvíos: arreglos en `db-worktree.sh` (bash 3.2, seed a la DB correcta) y en el setup de Vitest (`resetDb` en transacción, setupFiles). Se creó `elbravo_main` y `elbravo_main_test` en el repo principal (`.env.local`).
- W0-B mergeado (conflictos triviales en stubs y package.json). Gates OK en integración (typecheck, 38 tests, colores, build). Catálogo de componentes en `/dev/ui`. Arranca W0-C.
- W0-C mergeado. DB de integración `elbravo_main` migrada a v2 y sembrada; diff de Prisma vacío. Arranca la Ola 1 con 5 agentes.
- W1-2 (insignias) mergeado: 9 familias con niveles I/II/III, recálculo persistido con diff (solo muestra las afectadas), grilla + hoja de detalle en el perfil. 82 unit + 24 integración OK.
- W1-1 (puntos) mergeado: motor por días entrenados con curva decreciente, recálculo transaccional, premios de temporada, finalizar/publicar/reabrir idempotentes, cron. Verificado: 3 días×45 = 89 pts, borrar uno = 46, objetivo 2 = 66, +30 min el mismo día = +5. 129 unit + 51 integración OK.
- W1-5 (fotos) mergeado: subida directa a R2 con compresión WebP y miniatura de 400 px, hasta 4 por entrenamiento, borrado en cascada, script de migración. Verificado de punta a punta contra MinIO local (instalado con brew). **Falta tu cuenta de Cloudflare** (pasos en `docs/r2-setup.md`). 143 unit + 83 integración OK.
- W1-3 (ejercicios) mergeado: búsqueda tipo Strong (sin acentos, errores de tipeo, alias en inglés, filtros por músculo y equipamiento, recientes), botón "?" con descripción y pasos, crear ejercicio por tiempo con editor de músculos colapsable. Textos de los 78 ejercicios escritos (es-AR) y **pendientes de tu revisión** (`npx tsx scripts/exercises/validate.ts --pending`). Imágenes: 66/78 del dataset abierto free-exercise-db (Unlicense). 188 unit + 98 integración OK.
- W1-4 (social y cuentas) mergeado: sesiones revocables, login con rate limit, cambio de contraseña, `/settings`, seguir/amigos, perfil ajeno `/u/[id]`, reacciones, feed de amigos, invitar amigos a grupos con link personal, códigos de invitación seguros, roles y expulsión. Nota: las reacciones se guardan como clave ASCII (MySQL compara emojis como iguales con la collation actual).
- **Ola 1 completa.** Integración: 204 unit + 158 integración, typecheck y build OK. Arranca la Ola 2.
- W2-4 (home, perfil, stats) mergeado: home con progreso semanal, racha, posición en cada temporada y feed de amigos con carrusel de fotos y reacciones; perfil unificado (propio/ajeno) con historial y puntos por entrenamiento; página `/stats` con gráficos (semanal, categorías, días, músculos, récords). Bug de "semanas activas" corregido con tests de zona horaria. 233 unit + 162 integración OK.
- W2-3 (notificaciones) mergeado: notificaciones in-app con reglas (primero de la semana, semana cumplida, racha, te pasaron en el ranking, insignia, amigo entrenó, reacciones agrupadas, invitaciones, temporada empezó/publicada), campana con contador, `/notifications`, preferencias por tipo (app/email/push), Web Push con service worker, email por Resend (apagado sin dominio) y resumen semanal. Integración del orquestador: `HomeFeed` montado en la home y aviso de "resultados publicados" cableado en las acciones de temporada; el test de push ahora no depende de claves locales. 274 unit + 194 integración, build OK. Push en dispositivo real: sin probar (requiere HTTPS).
- W2-2 (grupo y temporadas) mergeado: página de grupo nueva (ranking con racha, semana, feed con puntos y reacciones, miembros, temporadas pasadas), invitar por link/compartir/amigos, ajustes del grupo con foto; wizard de temporada con sliders por actividad, premios elegibles, modo de resultados auto/manual y reglas avanzadas; pantalla final con reveal de premios, podio, tabla final, stats y "tus números". Verificado contra D1 a mano. Orquestador: pestaña Grupos activa en `/group/[id]`. 295 unit + 207 integración, build OK.
- W2-1 (entrenamientos y rutinas) mergeado: registro tipo Strong con series individuales (peso/reps/tiempo/descanso), "Anterior" por ejercicio, temporizador de descanso, modo en vivo a pantalla completa con retomar, editar entrenamiento, fotos, pantalla de envío con estados (guardando/error con reintento idempotente/resultado con puntos por temporada e insignias afectadas), reacciones en el detalle. Orquestador: borradas las últimas rutas y componentes viejos; solo quedan `app/api/cron/*` y `health`.
- **Ola 2 completa.** Integración: typecheck OK, 332 unit + 226 integración, **lint sin errores** (los heredados desaparecieron con las reescrituras), colores OK, build OK. Recorrido visual en el navegador (375 px, demo `ana@demo.test` / `demo1234` en `elbravo_main`): home, grupo, registrar y stats sin errores de consola.
- Arranca W3 (Tasks 1–3: E2E con Playwright, guardas estrictas, revisión de seguridad y performance).
- W3 Tasks 1–3 mergeadas:
  - **E2E:** 17 tests con Playwright, todos pasan. Cubren auth, registrar entrenamiento con fotos, modo en vivo, temporada completa con sliders y premios, social, reintento sin red y smoke visual de 24 páginas.
  - **Bugs reales encontrados y arreglados:** open redirect en `?next=`, series perdidas al recargar el modo en vivo, botón "Seguir" colgado.
  - **Seguridad** (detalle en `docs/security-review.md`):
    - un usuario podía borrar fotos ajenas;
    - las URLs prefirmadas no limitaban el tamaño;
    - el rate limit del login se podía saltear;
    - invitaciones viejas anulaban expulsiones;
    - SSRF por el endpoint de push;
    - faltaban headers de seguridad.
  - **Performance** (detalle en `docs/perf.md`): `recomputeSeason` ~190 ms con 6.000 actividades y página de grupo ~20 ms.
  - **Guardas:** lint con `no-alert` y reglas de fechas como error, 0 colores hex fuera de los tokens, README nuevo.

---

## Resumen para la mañana

**Estado:** el plan está ejecutado de la Ola 0 a la 2, más las Tasks 1–3 de W3, todo en la rama local `rework/v2`. No hice push de nada.

**Gates finales** en `rework/v2`:
- typecheck OK;
- lint con 0 problemas;
- 350 tests unitarios y 230 de integración;
- colores OK;
- build OK;
- E2E 17/17 OK, corrido también en la integración (1,4 min).

**Para probarla:**
```bash
cd ~/ElBravo && git checkout rework/v2 && npm ci && npm run dev
```
Abrí http://localhost:3000 y entrá con `ana@demo.test` / `demo1234` (datos demo en `elbravo_main`). Para fotos tiene que estar corriendo MinIO local; si no, mirá `docs/r2-setup.md`.

**Lo que te necesita a vos:**
1. **Revisar los textos de los 78 ejercicios** (escritos por IA, con `reviewed: false`): `npx tsx scripts/exercises/validate.ts --pending`.
2. **Cloudflare:** crear la cuenta y el bucket R2 siguiendo `docs/r2-setup.md`. Hay que verificar subidas reales contra R2.
3. **Base de producción (D13):** confirmar en Aiven qué es `el-bravo-prod` y elegir hosting para la DB nueva.
4. **W3 Task 4 (deploy):** hosting de la DB, variables en Vercel (`CRON_SECRET`, `APP_URL`, `R2_*`, `VAPID_*`) y `vercel.json` con los crons.
5. **Probar push en un celular real:** necesita HTTPS, es decir, un deploy de preview.
6. **W4 (APK de Android + widget):** necesita una cuenta de Firebase y Android Studio.
7. **Decidir:** email (dominio), iOS (Apple Developer) y los riesgos aceptados de `docs/security-review.md`.

**Desvíos que conviene saber:**
- Las reacciones se guardan como clave ASCII (`muscle`, `fire`…). Con la collation de MySQL los emojis se comparan como iguales.
- Expulsado de un grupo = no puede volver con el código, solo con una invitación personal.
- La racha "semanas cumplidas" del perfil y de stats cuenta entrenamientos por semana (como la insignia Imparable). La competencia de temporada cuenta días entrenados (D1).
- `Exercise.name` es único global: un ejercicio propio no puede llamarse igual que el de otro usuario.
