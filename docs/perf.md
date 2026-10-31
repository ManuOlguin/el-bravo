# Performance: línea de base (W3, 31-oct-2026)

**Objetivo (W3 Task 3):** con 3 temporadas × 10 usuarios × 200 actividades, `recomputeSeason` tiene que tardar menos de 300 ms y la página de grupo menos de 500 ms en el servidor.

**Resultado:** se cumplen los dos objetivos. No hizo falta agregar índices ni migraciones.

## Cómo se mide

```bash
# DB aparte (cualquier nombre que termine en _perf)
mysql -uroot -e "CREATE DATABASE elbravo_w3_perf CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
export DATABASE_URL=mysql://…/elbravo_w3_perf
npx prisma migrate deploy && npx tsx prisma/seed/index.ts
npx tsx scripts/perf/seed-perf.ts          # ~12 s

# funciones
npx tsx scripts/perf/measure.ts
# páginas: server de producción contra la misma DB
npm run build && npx next start -p 3032 &
PERF_BASE_URL=http://localhost:3032 npx tsx scripts/perf/measure.ts
```

**Datos (`scripts/perf/seed-perf.ts`, determinista):**
- 1 grupo con 10 usuarios que se siguen entre todos.
- 3 temporadas consecutivas de 10 semanas: las 2 primeras finalizadas y publicadas, y la 3ª en curso desde hace 5 semanas.
- 200 actividades por usuario y temporada (**6.000 en total**). Un tercio son de fuerza, con 3 ejercicios × 3 series.
- Todas las categorías tienen peso 1 y hay 3 premios por temporada.

**Medición (`scripts/perf/measure.ts`):**
- Una vuelta de calentamiento y 10 medidas.
- Las páginas se miden con `fetch` y el body leído entero, o sea, el render completo en el servidor, con la sesión de `perf0@perf.test`.

**Entorno:** MacBook (Apple Silicon), MySQL 8.4 local, `next start` (Next 16.1.1) y Node 22.

## Resultados

| Medición | Mediana | p90 | Máx | Objetivo |
|---|---|---|---|---|
| `recomputeSeason`, temporada en curso (2.000 actividades, 2.110 `ScoreEntry`) | **189 ms** | 208 ms | 208 ms | < 300 ms ✅ |
| `recomputeSeason`, temporada finalizada (no-op: resultados congelados) | 1 ms | 1 ms | 1 ms | — |
| `recomputeSeason`, `force: true` (reabrir; 10 semanas completas, 2.200 `ScoreEntry`) | 195–204 ms | 213 ms | 213 ms | < 300 ms ✅ |
| `recomputeUserBadges` (600 actividades del usuario) | 24 ms | 27 ms | 30 ms | — |
| GET página de grupo `/group/:id` | **19 ms** | 25 ms | 25 ms | < 500 ms ✅ |
| GET temporada en curso | 51 ms | 62 ms | 62 ms | — |
| GET temporada finalizada (resultados) | 37 ms | 39 ms | 39 ms | — |
| GET `/home` | 37 ms | 40 ms | 40 ms | — |
| GET `/profile` | 36 ms | 37 ms | 37 ms | — |
| GET perfil ajeno `/u/:id` | 35 ms | 58 ms | 58 ms | — |
| GET `/stats` | 35 ms | 35 ms | 35 ms | — |

**Costo de guardar un entrenamiento (estimado):** la mayor parte de `runActivityEffects` es `recomputeSeasonsForChange` (≈ un `recomputeSeason` por temporada activa del usuario, unos 190 ms con este volumen). A eso se suma `recomputeUserBadges` (~25 ms) y las notificaciones. Con este volumen da unos 250 ms por temporada activa en la que participa el usuario.

## Dónde va el tiempo y por qué no hay índices nuevos

- **`recomputeSeason`:** reescribe la temporada completa en una transacción (`DELETE` + `createMany` de ~2.100 `ScoreEntry` y los standings). Las escrituras dominan y la lectura de actividades es chica. El tiempo crece linealmente con las actividades **de esa temporada**, no con el total de la base.
- **`EXPLAIN` sobre la base de perf:**
  - La lectura de actividades (`userId IN (miembros) AND startedAt BETWEEN …`) y el `DELETE` de `ScoreEntry` por `seasonId` hacen full scan. En esta base, los 10 usuarios son todas las actividades y cada temporada es un tercio de `ScoreEntry`, así que el optimizador prefiere escanear.
  - Con más grupos en la base, `Activity(userId, startedAt)` y `ScoreEntry(seasonId, userId)`, que ya existen, se vuelven selectivos y se usan.
  - Los standings usan `SeasonStanding(seasonId, rank)`.
- **Páginas:** la de grupo pagina el feed y lee standings ya calculados, así que no depende del volumen histórico.

**Si algún día no alcanza** (por ejemplo, temporadas de 6 meses con 30 personas):
1. Recalcular solo las semanas afectadas por el cambio, en lugar de toda la temporada.
2. Pasar el `DELETE`/`INSERT` de `ScoreEntry` a un diff.

Antes de tocar índices, conviene volver a medir con `scripts/perf/measure.ts`.
