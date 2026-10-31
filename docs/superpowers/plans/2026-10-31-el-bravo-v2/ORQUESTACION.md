# Cómo ejecutar el plan con subagentes en paralelo

Esta es una guía para el orquestador: la sesión principal de Claude Code que coordina a los agentes.

## Antes de empezar
1. El dueño del producto responde las **decisiones abiertas** de `00-roadmap.md` §8. Las de la Ola 1 (D1 y D5) son las que bloquean; R2 y Resend pueden esperar hasta W1-5 y W2-3.
2. La rama de integración `rework/v2` existe y tiene estos planes commiteados.
3. Hay MySQL 8.4 local con `lower_case_table_names=1` y Node 22.

## Por cada ola
1. **Actualizar la integración:**
   - `git checkout rework/v2 && git pull` (si hay remoto);
   - `npm ci`;
   - `npx prisma migrate deploy` (con la DB de integración).
2. **Lanzar un agente por workstream**, en **un solo mensaje** con varias llamadas a `Agent`, cada una con `isolation: "worktree"`. Brief sugerido:

   > Sos el implementador del workstream `<ID>` de El Bravo v2. Trabajás en tu propio worktree, en una rama `v2/<id>` creada desde `rework/v2`. Primero corré `npm ci && npm run db:worktree -- <id> <puerto>` (si el script todavía no existe porque sos W0-A, creá vos la DB siguiendo tu Task 1). Leé completos `docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md` y `docs/superpowers/plans/2026-10-31-el-bravo-v2/<archivo del workstream>.md`. Ejecutá el plan tarea por tarea con la skill `superpowers:executing-plans`, con TDD y un commit por tarea. Respetá la tabla de propiedad de archivos (§6.2): si necesitás tocar un archivo de otro workstream, no lo hagas; anotalo en tu informe final. No cambies el schema de Prisma salvo que tu plan lo diga. Al terminar, corré `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build` y verificá la UI en el puerto `<puerto>` a 375 px. Informe final: tareas hechas, desvíos del plan con su motivo, pendientes, archivos ajenos que necesitarías tocar y cómo verificarlo a mano.

3. **Revisar cada informe** (sin dar por buena la palabra del agente). Por cada rama:
   1. `git diff rework/v2...v2/<id> --stat` y revisión del diff (skill `superpowers:requesting-code-review` o `/code-review`).
   2. Correr los gates en el worktree.
   3. Probar los flujos de la "Verificación final" del plan.
4. **Mergear en el orden de §6.1** con `git merge --no-ff v2/<id>`. Resolver los conflictos en los archivos compartidos de bajo riesgo (`next.config.ts`, `nav-items.ts`, `.env.example`, `package.json`) y correr los gates en `rework/v2` después de cada merge.
5. **Antes de la ola siguiente**, actualizar `00-roadmap.md` si cambió algún contrato y avisar en el brief.

## Paralelismo por ola

| Ola | Agentes en paralelo | Notas |
|---|---|---|
| 0a | W0-A, W0-B | W0-B puede usar stubs temporales de `getSession` y `ActionResult` (marcados `TEMP W0-B`) |
| 0b | W0-C | secuencial: concentra el schema |
| 1 | W1-1, W1-2, W1-3, W1-4, W1-5 | 5 agentes |
| 2 | W2-1, W2-2, W2-3, W2-4 | 4 agentes |
| 3 | W3 | 1 agente + el dueño del producto para producción |
| 4 | W4 | 1 agente (Android); iOS opcional después. Necesita Android Studio y una cuenta de Firebase en la máquina |

## Señales para frenar y consultar al dueño del producto
- Un test de D1 contradice la intuición del producto: por ejemplo, que los puntos de un caso real "se sientan" injustos.
- La licencia del dataset de imágenes no es compatible (W1-3).
- Cualquier operación contra la base de producción.
- Crear cuentas en servicios externos (Cloudflare, Firebase, hosting de la DB, Apple): las crea el dueño del producto; el agente solo guía.
