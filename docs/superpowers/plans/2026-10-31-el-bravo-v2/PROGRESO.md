# Progreso de la ejecución (noche del 31-oct-2026)

Registro del orquestador. Cada ola se ejecuta con subagentes en worktrees separados; al terminar, el orquestador revisa, mergea a `rework/v2` y corre los gates.

| Ola | Workstream | Estado | Rama | Notas |
|---|---|---|---|---|
| 0a | W0-A Base técnica | ✅ mergeado | `v2/w0-a-base` | 6 commits; typecheck, tests (38 unit + 1 int), build y colores OK. Lint: quedan 55 errores heredados (`no-explicit-any`) que se van con las reescrituras |
| 0a | W0-B Base UI + PWA | ✅ mergeado | `v2/w0-b-ui` | 6 commits: tokens + Montserrat, Button con pending, toasts/modal/sheet/confirm, primitivas, shell con bottom nav, PWA. Verificado en navegador: sin scroll horizontal a 375 px y fondo oscuro aunque el celular esté en modo claro |
| 0b | W0-C Schema v2 | ✅ mergeado | `v2/w0-c-schema` | 5 commits: schema v2 completo en una migración, migración de datos v1→v2 probada con fixture, seed modular, servicio único de actividades (idempotente, transaccional, hora local→UTC), puente para que las pantallas viejas funcionen. 43 unit + 16 integración OK |
| 1 | W1-1 Puntos · W1-2 Insignias · W1-3 Ejercicios · W1-4 Social · W1-5 Fotos | ✅ mergeados | `v2/w1-*` | ver bitácora |
| 2 | W2-1 Entrenamientos · W2-2 Grupo/Temporadas · W2-3 Notificaciones · W2-4 Home/Perfil/Stats | ⏳ en curso (4 agentes) | `v2/w2-*` | |
| 3 | W3 Release | no se ejecuta sin vos (producción, cuentas externas) | | |
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
