# Progreso de la ejecución (noche del 31-oct-2026)

Registro del orquestador. Cada ola se ejecuta con subagentes en worktrees separados; al terminar, el orquestador revisa, mergea a `rework/v2` y corre los gates.

| Ola | Workstream | Estado | Rama | Notas |
|---|---|---|---|---|
| 0a | W0-A Base técnica | ✅ mergeado | `v2/w0-a-base` | 6 commits; typecheck, tests (38 unit + 1 int), build y colores OK. Lint: quedan 55 errores heredados (`no-explicit-any`) que se van con las reescrituras |
| 0a | W0-B Base UI + PWA | ✅ mergeado | `v2/w0-b-ui` | 6 commits: tokens + Montserrat, Button con pending, toasts/modal/sheet/confirm, primitivas, shell con bottom nav, PWA. Verificado en navegador: sin scroll horizontal a 375 px y fondo oscuro aunque el celular esté en modo claro |
| 0b | W0-C Schema v2 | ✅ mergeado | `v2/w0-c-schema` | 5 commits: schema v2 completo en una migración, migración de datos v1→v2 probada con fixture, seed modular, servicio único de actividades (idempotente, transaccional, hora local→UTC), puente para que las pantallas viejas funcionen. 43 unit + 16 integración OK |
| 1 | W1-1 Puntos · W1-2 Insignias · W1-3 Ejercicios · W1-4 Social · W1-5 Fotos | ⏳ en curso (5 agentes en paralelo) | `v2/w1-*` | |
| 2 | W2-1 … W2-4 | pendiente | | |
| 3 | W3 Release | no se ejecuta sin vos (producción, cuentas externas) | | |
| 4 | W4 App móvil | no se ejecuta sin vos (Firebase, Android Studio) | | |

## Bitácora
- 31-oct: arranca la Ola 0a.
- W0-A terminado y mergeado. Desvíos: arreglos en `db-worktree.sh` (bash 3.2, seed a la DB correcta) y en el setup de Vitest (`resetDb` en transacción, setupFiles). Se creó `elbravo_main` y `elbravo_main_test` en el repo principal (`.env.local`).
- W0-B mergeado (conflictos triviales en stubs y package.json). Gates OK en integración (typecheck, 38 tests, colores, build). Catálogo de componentes en `/dev/ui`. Arranca W0-C.
- W0-C mergeado. DB de integración `elbravo_main` migrada a v2 y sembrada; diff de Prisma vacío. Arranca la Ola 1 con 5 agentes.
