# El Bravo v2 — Hoja de ruta (plan maestro)

> **Para agentes:** este archivo es el contrato común. Antes de ejecutar tu plan de workstream (`W*.md`), leé este archivo completo: las secciones **Restricciones globales**, **Contratos entre workstreams** y **Propiedad de archivos** son obligatorias para todas las tareas. SUB-SKILL REQUERIDA para ejecutar cada workstream: `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** llevar El Bravo de un MVP abandonado e inconsistente a una app estable, consistente y gamificada, donde los puntos y las insignias son deterministas y recalculables, el registro de entrenamientos es tipo Strong y el aspecto social (amigos, novedades, finales de temporada) motiva a entrenar.

**Arquitectura:** se mantiene Next.js 16 (App Router) + Prisma 7 + MySQL. Se reescribe el núcleo de dominio (puntos, insignias, tiempo, actividades) como **funciones puras + un único camino de escritura** que recalcula todo desde los datos fuente. La UI se reconstruye sobre un sistema de diseño con tokens y primitivas compartidas, mobile-first, y las mutaciones pasan a Server Actions con feedback uniforme (pending + toast).

**Stack:** Next.js 16.1, React 19.2, Tailwind 4, Prisma 7 (MySQL 8.4 / adapter mariadb), Zod 4, Vitest (nuevo), `jose` + `bcryptjs`, Cloudflare R2 (S3 API, nuevo), Resend (email, nuevo).

**Spec:** este documento. Los diagnósticos que lo fundamentan están resumidos en la sección 1.

---

## 1. Diagnóstico del estado actual (31-oct-2026)

Repositorio `ManuOlguin/el-bravo`, último commit funcional `ab1df60` (2-abr-2026, "MVP básico completado (A revisar por los muchachos)"). Hay unas 9.000 líneas en Next.js, sin tests, `next build` roto (5 errores de TypeScript) y 84 problemas de lint.

### 1.1 Puntos y temporadas: hay que reescribirlos

- **El puntaje depende del orden.** Cada actividad se puntúa al crearla con multiplicadores de consistencia y bonus de regreso calculados sobre las actividades *anteriores*. Si se borra o se carga una actividad con fecha vieja, no se recalculan las posteriores. El mismo conjunto de actividades da totales distintos según el orden de carga: ese es el "medio random" que se notaba.
- **Las rachas se premian 4 veces:** multiplicador, bonus de semana perfecta, bonus de racha y pozo final. Además, "semana perfecta" es exactamente lo mismo que "objetivo cumplido".
- **Editar una temporada no recalcula nada.** Borrar una actividad de una temporada finalizada deja los bonus finales viejos.
- **La finalización se dispara al renderizar la página del grupo (GET).** Dos visitas concurrentes pueden duplicar los bonus finales.
- **Las fechas de temporada se guardan a las 12:00 UTC.** Las actividades antes de las 9:00 del primer día no cuentan y la temporada cierra a las 9:00 del último día.
- **Las semanas se calculan con la zona horaria del servidor** (`setHours`/`getDay`). En Vercel (UTC), un entrenamiento del domingo 22:00 en Argentina cae en la semana siguiente.
- **El ranking del grupo siempre muestra 0 semanas activas y 0 perfectas**, porque faltan campos en `getSeasonLeaderboard`.

### 1.2 Insignias: hay que reescribirlas

- **Nunca se guardan.** Se evalúan en vivo al renderizar el perfil, así que `AwardEarned` está siempre vacío.
- **Las métricas incluyen actividades borradas** (falta el filtro `isDeleted:false`).
- **"El Persistente" es imposible de ganar.** El seed usa `"strength"` y la métrica espera el enum legacy `gym`. "strength Rat" es un find-and-replace accidental de "Gym Rat".
- **Los niveles I/II/III son filas separadas** y se muestran como insignias distintas.
- **No hay forma de saber qué insignias afectó un entrenamiento**, porque no existe un estado previo con el que comparar.

### 1.3 Registro de entrenamientos, rutinas y ejercicios

- **Crear una rutina con un ejercicio por tiempo falla siempre.** El schema de Zod exige `reps ≥ 1`, y además descarta `weightKg`/`durationSeconds` en silencio.
- **El mensaje de error real se pierde:** se lee `error.errors` en lugar de `.issues` (Zod 4).
- **Los ejercicios nuevos se crean antes que la rutina y sin guard de doble envío.** Al reintentar aparece "Ya existe un ejercicio con ese nombre". Esto explica el "error al crear rutina que pasa a veces".
- **El tiempo se guarda bien en UTC; el problema es cómo se muestra.** Los Server Components formatean sin `timeZone`, así que en un servidor UTC se ve +3 h. `User.timezone` existe pero nunca se lee.
- **Datos redundantes:** el cliente deriva `endedAt` desde la duración y el servidor recalcula `durationMinutes`.
- **Otros problemas del modelo y del flujo de carga:**
  - Una sola fila de series/reps/peso por ejercicio, sin orden, sin tiempos de descanso y sin series distintas.
  - Cargar running o yoga exige agregar un "ejercicio".
  - No se puede editar un entrenamiento.
  - Después de guardar no hay pantalla de resultado (`history.back()`).
- **`ActivityMedia` existe pero nada sube fotos.** Las fotos de perfil y de grupo son URLs pegadas a mano, y en el repo no hay código de Vercel Blob que migrar.
- **El catálogo tiene 78 ejercicios sin descripción, sin equipamiento y sin alias.** La búsqueda no ignora acentos ("triceps" no encuentra "Tríceps").

### 1.4 Social, UI y plataforma

- **Faltan funciones enteras:** amigos/seguir, perfil ajeno, cambio de contraseña (el botón dice "Próximamente"), notificaciones, página de stats y pantalla de fin de temporada. La página `season/[seasonId]` existe pero es un archivo de 0 bytes.
- **Modo oscuro:** `globals.css` pinta el `body` según `prefers-color-scheme` y no declara `color-scheme`. Los navegadores con "auto dark" recolorean la página. Se nota en el overscroll, en la barra del navegador y en el flash al recargar.
- **"Semanas activas" muestra 1 menos:**
  - La clave de semana es la fecha UTC del lunes local, que se vuelve a parsear como fecha local. En zonas al este de UTC eso corre todo una semana.
  - En UTC u oeste, el cálculo cuenta semanas distintas en lugar de una racha.
  - Además, el perfil solo mira las últimas 50 actividades.
- **Feedback de botones:**
  - Hay 24 `alert()` y 11 `confirm()`.
  - No hay estados `active:` ni toasts de éxito.
  - Toda la navegación usa `<a>` plano (recarga completa) y no hay `loading.tsx`.
- **Sistema visual:**
  - Hay 69 colores hex hardcodeados.
  - La fuente Montserrat se declara pero no se carga; en la práctica se renderiza Arial.
  - No hay navegación inferior en el celular, el texto es enorme en 375 px y el header se desborda.
- **Seguridad:**
  - Un admin expulsado que vuelve a entrar recupera el rol de admin.
  - Los códigos de invitación son de 6 dígitos con `Math.random`, sin rate limit.
  - El `inviteCode` y los emails de los miembros se envían al cliente.
  - El JWT dura 30 días y no se puede revocar.
- **Código muerto:**
  - Componentes: `GroupTabs`, `GroupSeasonRank`, `GroupSeasonMembers*`, `GroupSeasonActivities*`, `KickMemberButton`, `DeleteSeasonButton` y `ExerciseSelector`.
  - Endpoints: `/api/seasons/leave` y `/api/profile/update/awards`.
  - Páginas: `/dashboard`, `/group`, `/group/edit` y `/group/[id]/edit` (esta última sin links que lleguen a ella).

---

## 2. Mapeo de cada pedido → estado → dónde se resuelve

| # | Pedido original | Estado hoy | Se resuelve en |
|---|---|---|---|
| 1 | Rework total del sistema de puntos, más simple | BUG (orden-dependiente, 4× rachas) | **W1-1** (motor nuevo) |
| 2 | Editar season debería recalcular el scoring | FALTA | **W1-1** (`recomputeSeason` en update) |
| 3 | Sistema de amigos, agregar/seguir | FALTA | **W1-4** |
| 4 | Cambiar contraseña | FALTA (placeholder) | **W1-4** |
| 5 | Notificaciones al mail | FALTA | **W2-3** (outbox + Resend) |
| 6 | Botón + (agregar ejercicio) más simple en crear rutina | PARCIAL | **W2-1** (`ExercisePicker` + botón al pie) |
| 7 | Lista de músculos ocultable al pasar al próximo ejercicio | FALTA | **W1-3** (`CreateExerciseSheet` con `MuscleShareEditor` colapsable) |
| 8 | Botón "?" con descripción (+GIF/SVG) en cada ejercicio | FALTA | **W1-3** (`ExerciseInfoButton`) |
| 9 | Fotos de actividades | FALTA (modelo sin uso) | **W1-5** (subida R2) + **W2-1** (en el flujo) |
| 10 | Feedback claro al tocar botones | PARCIAL | **W0-B** (primitivas) + todos los W (uso obligatorio) |
| 11 | Crear ejercicio no deja elegir "por tiempo" | FALTA | **W1-3** |
| 12 | Tabla de ranking final | FALTA | **W2-2** |
| 13 | Página de perfil ajeno | FALTA | **W1-4** (`/u/[id]`) + **W2-4** (diseño) |
| 14 | Reprocesar bien los puntos viejos al borrar | BUG | **W1-1** (recálculo total) |
| 15 | Recalcular badges al borrar actividad | BUG | **W1-2** |
| 16 | Unificar badges I, II en una con niveles | FALTA | **W1-2** (`Badge` + `BadgeLevel`) |
| 17 | Pantalla post-entreno muestra badges no afectadas | BUG (no hay diff) | **W1-2** (diff antes/después) + **W2-1** (pantalla) |
| 18 | Colores cambian en modo oscuro del celular | BUG | **W0-B** |
| 19 | Copiar a Strong: descansos, peso/tiempo distinto por serie | FALTA | **W0-C** (modelo `*Set`) + **W2-1** (UI) |
| 20 | Notificaciones de entrenamientos del grupo (feed en home) | FALTA | **W2-3** |
| 21 | Rutina en pantalla completa "en tiempo real", tachando | FALTA | **W2-1** (`/routines/[id]/live`) |
| 22 | Error al crear rutina (a veces) | BUG (identificado) | **W0-A** (hotfix) + **W2-1** (reescritura) |
| 23 | Semana activa muestra 1 menos (home y perfil) | BUG (identificado) | **W0-A** (`src/lib/time`) + **W2-4** (stats unificadas) |
| 24 | Retocar página stats + acceso | FALTA (no existe) | **W2-4** (`/stats` + tab en nav) |
| 25 | Mejorar agregado de ejercicios | PARCIAL | **W1-3** + **W2-1** |
| 26 | Data por ejercicio: texto, video/gif (¿IA?) | FALTA | **W1-3** (dataset abierto + textos revisados; ver D6) |
| 27 | Sinónimos/nombres en inglés para búsqueda | FALTA | **W1-3** (`ExerciseAlias`) |
| 28 | Búsqueda de ejercicio tipo Strong | PARCIAL | **W1-3** (`ExercisePicker`: filtros, recientes, fuzzy) |
| 29 | Pantalla de finalización de season (ranking, stats, premios; admin elige premios y modo auto/manual) | FALTA | **W1-1** (motor + premios) + **W2-2** (UI) |
| 30 | Fotos para los entrenamientos | = #9 | **W1-5** + **W2-1** |
| 31 | Mostrar puntos ganados por entrenamiento | FALTA | **W1-1** (`ScoreEntry` por actividad) + **W2-1/W2-4** (UI) |
| 32 | Sliders por tipo de actividad para seasons | FALTA | **W0-C** (`SeasonCategory.weight`) + **W1-1** + **W2-2** |
| 33 | Pantalla post-entreno con "en proceso" / error / éxito | FALTA | **W2-1** (`SubmitWorkoutScreen`) |
| 34 | Hora +3 h; endedAt y minutos redundantes | BUG (de display) | **W0-A** (`src/lib/time`) + **W0-C** (se elimina `endedAt`) |
| 35 | Editar entrenamiento | FALTA | **W0-C** (servicio) + **W2-1** (UI) |
| 36 | Migrar imágenes de Vercel a Cloudflare | No hay código en el repo; puede haber URLs en la DB de prod | **W1-5** (script de migración de URLs) |
| 37 | Reacciones a entrenamientos | FALTA | **W0-C** (`Reaction`) + **W1-4** (acciones) + **W2-1/W2-4** (UI) + **W2-3** (notificación) |
| 38 | Feed de amigos e invitar amigos a grupos | FALTA | **W1-4** (queries/acciones) + **W2-4** (home) + **W2-2** (invitar) |
| 39 | Instalable como app (Android/iOS) | FALTA | **W0-B** (PWA) + **W4** (Capacitor) |
| 40 | Notificaciones push | FALTA | **W0-C** (`Device`) + **W2-3** (Web Push) + **W4** (push nativo) |
| 41 | Widget tipo Locket con entrenamientos de amigos | FALTA | **W1-5** (miniaturas) + **W4** (API del widget + widget Android; iOS opcional) |

Además, el diagnóstico encontró trabajo que no estaba en la lista y es necesario para "estable y consistente": build verde, tests, auth central, seguridad de grupos, sistema de diseño y navegación mobile. Eso se reparte en **W0-A**, **W0-B**, **W1-4** y **W3**.

---

## 3. Decisiones de diseño

Cada decisión trae una recomendación. Las marcadas con **⚠️ confirmar** necesitan el OK del dueño del producto antes de arrancar la ola que las usa.

### D1. Puntos v2: la constancia manda y el tiempo suma con rendimiento decreciente ✅ aprobada (31-oct)

**Principio del producto:** la competencia de temporada mide **constancia** (cuántos días entrenás) y **tiempo** entrenado. No mide esfuerzo, peso ni intensidad. El objetivo es motivar a ir más veces, sin importar qué hacés en cada entrenamiento. Las insignias de grupos musculares, volumen, etc. son logros personales y divertidos que **no** afectan la temporada (D2).

Los puntos se **derivan** siempre de los datos fuente con una función pura. Nunca se acumulan incrementalmente. Cualquier cambio dispara `recomputeSeason(seasonId)`: crear, editar o borrar una actividad, editar la temporada, unirse o salir. Esa función reescribe en una transacción las tablas `ScoreEntry` y `SeasonStanding` de esa temporada.

Reglas, con valores por defecto configurables por temporada:

1. **Actividad que cuenta:** su fecha local (zona horaria del grupo) cae entre `startDate` y `endDate` inclusive, y su categoría está habilitada (peso > 0).
2. **Día entrenado:** todas las actividades que cuentan en un mismo día local **se suman** en minutos efectivos (`duración × peso de la categoría`; el peso es el **slider** de la temporada, de 0 a 2 en pasos de 0,25). El día cuenta si suma ≥ `minDailyMinutes` (20).
3. **Puntos del día:** `dayBasePoints + round(timePointsFactor × log2(1 + min(minutos, maxDailyMinutes) / timeCurveMinutes))`, con valores por defecto 10, 10, tope de 240 min y curva de 30 min. Esto da 20 min = 17, 30 min = 20, 45 min = 23, 1 h = 26, 1 h 30 = 30, 2 h = 33, 3 h = 38 y 4 h = 42. Entrenar más siempre suma, pero cada vez menos (3 h ≈ 1,46× lo de 1 h), y dos días de 30 min (40) valen más que un día de 3 h (38).
4. **Puntos por actividad** (para mostrar "+N pts" en cada entrenamiento): reparto marginal dentro del día, en orden de `startedAt`. Cada actividad recibe `P(minutos acumulados con ella) − P(minutos acumulados antes)`, así que la suma de las actividades da exactamente los puntos del día.
5. **Objetivo semanal:** `+weeklyGoalBonus` (20) por cada semana (lunes a domingo, zona del grupo) con al menos `weeklyGoal` **días entrenados**. Si la temporada empieza o termina a mitad de semana, el objetivo es `min(weeklyGoal, días de la semana dentro de la temporada)`.
6. **Racha:** cada semana cumplida consecutiva suma `+min((racha − 1) × streakBonusStep, streakBonusCap)`, con valores por defecto +5 y +25. La semana en curso no corta la racha mientras no haya terminado.
7. **Premios de temporada:** el admin los elige al crear la temporada (ver D3). Cada premio puede dar `bonusPoints` (0 por defecto) y se calcula al finalizar.
8. **Ranking:** puntos desc → semanas cumplidas desc → días entrenados desc. Los empates comparten puesto (1, 1, 3).

Explicación para el usuario: *"Cada día que entrenás suma 10 pts por presentarte, más puntos por el tiempo, que crecen cada vez más despacio (30 min = 20 pts, 1 h = 26, 2 h = 33). Varias actividades el mismo día se suman al tiempo del día. +20 por cumplir tus días de la semana y +5 extra por cada semana seguida de racha (hasta +25)."*

Comparación con v1, en una semana con objetivo de 3 días:

| Escenario | v1 | v2 |
|---|---|---|
| 4 días × 45 min | 50 | 112 |
| 2 días × 2 h | 26 | 66 |
| 3 días de 1 h, uno con 30 min extra | 47 | 102 |
| 1 solo día con 3 actividades de 45 min | 40 | 35 |

Se eliminan:
- el multiplicador por duración y el de consistencia;
- el bonus de regreso, que premiaba haber faltado;
- el pozo de "racha más larga" y el pozo de "sesión más larga";
- la posibilidad de cumplir el objetivo semanal con varias actividades en un día;
- `SeasonWeekProgress` y `ScoreEvent`.

### D2. Insignias v2: una insignia con niveles, guardada y recalculable

- **Modelo:** `Badge` (familia: código, nombre, métrica y parámetros) + `BadgeLevel` (nivel, umbral) + `UserBadge` (nivel actual, progreso, fecha de logro).
- **Cálculo:** las métricas son de por vida y salen de una función pura sobre todas las actividades del usuario (no hay "soft delete": ver D7). Las rachas son "la mejor histórica", no la actual.
- **Recálculo:** después de cada cambio de actividad se ejecuta `recomputeUserBadges(userId)`, que devuelve un `BadgeChange[]` con solo las insignias cuyo nivel o progreso cambió. La pantalla post-entreno muestra únicamente esas.
- **Si se borra una actividad, el nivel puede bajar.** Es el comportamiento correcto para "recalcular al borrar".
- **Familias iniciales:** se migran las 13 definiciones actuales y se corrigen nombres.
  - El Persistente: entrenamientos totales.
  - Gym Rat: fuerza, calistenia y crossfit.
  - Corre Forrest: running y trail.
  - Imparable: mejor racha de semanas cumplidas.
  - El Piernas: series de piernas.
  - Six Pack: series de core.
  - Todoterreno: categorías distintas.
  - Se suman Maratonista (minutos totales) y Madrugador (entrenamientos antes de las 8:00 locales).

### D3. Temporadas: ciclo de vida explícito y pantalla final

- **Fechas:** `startDate`/`endDate` son **fechas locales** (`@db.Date`) en la zona horaria del grupo (`Group.timezone`, por defecto `America/Argentina/Buenos_Aires`).
- **Estado:** se deriva con `seasonStatus(season, now)`, que devuelve `upcoming | active | ended | finalized`. El único campo guardado es `finalizedAt`, que congela los resultados.
- **Publicación de resultados:** `resultsReveal: auto | manual`.
  - `auto`: un cron diario y, como respaldo, la primera visita después del fin finalizan la temporada de forma idempotente (lock de fila + chequeo de `finalizedAt` dentro de la transacción).
  - `manual`: el admin ve "Publicar resultados" y los miembros ven "Esperando resultados".
- **Premios:** el admin los elige al crear o editar la temporada, de un catálogo en código.
  - `most_days`, `most_minutes`, `best_streak`, `longest_session`, `most_categories`, `perfect_attendance`.
  - Los empates ganan todos.
- **Pantalla final** (`/group/[id]/season/[seasonId]`): podio, tabla de ranking final, premios con ganadores, stats de la temporada (entrenamientos, minutos, mejor racha, categoría más usada) y "tus números".

### D4. Tiempo: una sola fuente

`src/lib/time` es la única forma de calcular semanas, fechas locales y formatos.
- **Guardado:** se guarda `startedAt` en UTC + `durationMinutes`. Se elimina `endedAt`.
- **Pantalla:** se formatea siempre con `timeZone` explícita: la del grupo para todo lo que es competencia, la del usuario para su perfil y sus stats.
- **Implementación:** sin dependencias nuevas, con `Intl.DateTimeFormat`.

### D5. Social: seguir + reacciones ✅ aprobada (31-oct)

- **Modelo:** `Follow(followerId, followingId)`, sin solicitudes. "Amigos" = seguimiento mutuo.
- **Qué habilita:**
  - un feed de actividad de amigos en la home (con foto);
  - notificaciones cuando un amigo entrena o sube de nivel una insignia, que se pueden apagar;
  - invitar amigos a un grupo eligiéndolos de una lista, sin código;
  - ver sus perfiles e insignias;
  - sugerencias de gente de tus grupos para seguir.
- **Reacciones:** `Reaction(activityId, userId, emoji)` con un set fijo (💪 🔥 👏 😂 🫡). Una por emoji por usuario; tocar de nuevo la quita. Notifican al dueño del entrenamiento (`reaction_received`), agrupadas.
- **Perfil:** el perfil ajeno `/u/[id]` es público para usuarios logueados.

### D6. Medios del catálogo de ejercicios: dataset abierto, no IA ✅ aprobada (31-oct)

- **Por qué no IA:** los videos o GIFs generados con IA hoy cometen errores de técnica y de anatomía, un riesgo para indicaciones de forma.
- **Imágenes:** se usa [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público / Unlicense; **verificar licencia en la tarea**) para los ejercicios que coincidan. El resto queda con un ícono SVG por grupo muscular.
- **Textos:** las descripciones y los pasos (es-AR) se redactan con IA en un script **y los revisa un humano** antes de commitearlos al seed.

### D7. Borrado duro de actividades

Como todo es recalculable, borrar es `DELETE` real. Se elimina `isDeleted`/`deletedAt`, que hoy causa bugs: las métricas no filtran por ese campo y los hijos se borran igual.

### D8. Imágenes: Cloudflare R2 con subida directa ⚠️ falta crear la cuenta (gratis)

- **Subida:**
  1. El cliente comprime a WebP (máx. 1600 px).
  2. Pide una URL prefirmada (Server Action).
  3. Hace `PUT` directo a R2.
  4. Confirma (Server Action), y recién ahí se crea `ActivityMedia` o se actualiza `photoUrl`.
- **Lectura:** desde el dominio público del bucket (`R2_PUBLIC_BASE_URL`).
- **Miniaturas:** el cliente genera también una miniatura de 400 px (`thumbUrl`) para feeds, el widget del celular y las notificaciones.
- **Datos existentes:** probablemente no hay (ver D13). El script de migración de URLs queda por si aparecen imágenes viejas.
- **Desarrollo sin cuenta:** se usa MinIO local, que es compatible con S3.

### D9. Email: Resend + outbox ⏸️ postergado hasta tener dominio propio

- **Outbox:** las notificaciones se guardan siempre en la tabla `Notification` (el feed in-app).
- **Envío:** un cron (`/api/cron/notifications`, protegido con `CRON_SECRET`) envía por email lo pendiente según las preferencias del usuario.
- **Por defecto:** el email llega desactivado, salvo un resumen semanal opcional.
- **Estado:** sin dominio propio no se puede mandar email confiable. Se construye el canal y queda apagado si falta `RESEND_API_KEY`. Las notificaciones in-app y **push** (D12) no dependen de esto.

### D10. Mutaciones: Server Actions con resultado uniforme

- **Server Actions:** toda mutación disparada desde la UI es una Server Action en `src/server/actions/<dominio>.ts`, que devuelve `ActionResult<T>`.
- **Route handlers:** quedan solo para uploads, cron y health.
- **En la UI:** se usa `useActionState` o `useTransition` + `<Button pending>` + `toast`.
- **Migración de `app/api/*`:** cada workstream migra los endpoints de su dominio y los borra.

### D11. Tests

- **Lógica pura** (tiempo, puntos, insignias, búsqueda): Vitest con tests unitarios.
- **Servicios con DB:** Vitest de integración contra `elbravo_test` (MySQL local), usando el helper `resetDb()`.
- **E2E:** en W3, con Playwright (smoke de flujos críticos).
- **UI:** se verifica a mano con el dev server en cada tarea de UI, en viewport de 375 px.

### D12. Web primero, instalable como app (PWA), después app nativa con widget ✅ dirección aprobada (31-oct)

El objetivo es una web que también se instale como app en Android e iOS, con notificaciones push y un **widget tipo Locket** en la pantalla de inicio que muestre los últimos entrenamientos de tus amigos con foto. Por ahora es para uso interno del grupo de amigos, así que una instalación rudimentaria está bien.

Hay una sola base de código web. El orden es este:

1. **PWA (Olas 0 y 2):** manifest, íconos, pantalla completa sin barra del navegador, safe areas y **Web Push**.
   - Se instala desde el navegador con "Agregar a pantalla de inicio".
   - En Android funciona todo.
   - En iOS el push funciona solo con la app instalada en la pantalla de inicio, desde iOS 16.4.
   - **No permite widgets.**
2. **App nativa con Capacitor (Ola 4):** un "envoltorio" nativo que carga la web deployada.
   - En Android da un **APK** que se pasa por link o WhatsApp y se instala aceptando "orígenes desconocidos".
   - Suma push nativo (Firebase Cloud Messaging), cámara nativa y, sobre todo, el **widget de pantalla de inicio**, que se escribe en código nativo (Kotlin con Jetpack Glance en Android).
   - Lo que **no** se reescribe: casi nada. La app es la misma web.
3. **iOS nativo (Ola 4, opcional):** el mismo proyecto Capacitor y un widget en Swift (WidgetKit).
   - Hace falta una Mac con Xcode.
   - Para instalarla en los iPhones de los amigos hace falta la cuenta Apple Developer (USD 99 por año, vía TestFlight). Sin esa cuenta, se puede instalar desde Xcode en tu propio iPhone, pero vence cada 7 días.

**Cómo se prepara la web para esto, desde ya:**
- **Modelo `Device`** en el schema (W0-C): token de push web o nativo y token propio para el widget.
- **Notificaciones con canal push** (W2-3), además de in-app y email.
- **Miniaturas de fotos** (W1-5), para el widget.
- **API JSON mínima** para el widget (`/api/widget/feed`): las Server Actions no sirven fuera del navegador.
- **UI mobile-first** con safe areas (W0-B).

**Alternativa descartada:** React Native o Expo, que implicaría reescribir toda la UI.

### D13. Base de datos de producción: empezar de cero ⚠️ confirmar

Los mails de Aiven muestran que el servicio `el-bravo-prod-sql` estuvo apagado más de 90 días y estaba programado para borrarse el 1 de octubre de 2026. Muy probablemente ya no existe. En el proyecto de Aiven de Leo (`leojmelman-6905`) aparece también un servicio `el-bravo-prod`, con mantenimiento el 5 de octubre: hay que confirmar en la consola qué es y si tiene datos.

- **Si no hay datos:** v2 arranca con una DB nueva. W3 no migra producción; solo deploya y siembra.
- **Si hay datos:** se usa el camino de migración de W0-C y W3, con backup previo.
- **Hosting de la DB:** hay que elegir uno que **no se borre por inactividad**. Recomendación: un MySQL serverless con plan gratis (por ejemplo TiDB Cloud Starter, que es compatible con MySQL; verificar las condiciones vigentes al elegir), o Aiven con un plan pago chico. Se decide en W3.

---

## 4. Restricciones globales (aplican a todas las tareas)

- **Node ≥ 22.12.** MySQL 8.4 local con `lower_case_table_names=1`. Nunca usar `prisma db push`: todo cambio de schema es una migración (`prisma migrate dev --name …`).
- **Idioma:** textos de UI en español rioplatense (vos, "registrá", "cargá"). Identificadores, nombres de archivos y commits técnicos en inglés. Mensajes de error al usuario en español.
- **Diseño:** solo modo oscuro. Mobile-first: todo tiene que verse bien en **375 px** sin scroll horizontal y escalar a desktop con `max-w-screen-sm` centrado en páginas de contenido.
- **Colores:** **prohibido el hex hardcodeado en componentes.** Solo tokens de `app/globals.css` (`bg-bg`, `bg-surface-1`, `text-fg-muted`, `bg-primary`…). Lo verifica `npm run lint:colors` (lo crea W0-A).
- **Navegación:** con `next/link` (`<Link>`), nunca `<a href>` interno.
- **Feedback:** **todo botón que dispara una acción usa `<Button pending>`** y el resultado se comunica con `toast.success`/`toast.error`. Nunca usar `alert()`/`confirm()`: se usa `<ConfirmDialog>`.
- **Fechas:** toda fecha mostrada o agrupada por semana o día pasa por `src/lib/time`. Prohibido `toLocaleString` sin `timeZone`, `setHours`, `getDay` y `getDate` en código de dominio.
- **Auth:** todo acceso a la sesión usa `src/server/auth/dal.ts` (`requireUser`, `requireGroupMember`, `requireGroupAdmin`). No leer cookies ni JWT en otro lado.
- **Validación:** todo input de mutación se valida con Zod 4. Los errores se devuelven con `issues` mapeados a `fieldErrors`.
- **Recálculo:** nada calcula puntos ni insignias fuera de `src/server/scoring` y `src/server/badges`. Toda mutación de actividad o temporada llama a `runActivityEffects` o `recomputeSeason`.
- **Calidad:** cada tarea termina con `npm run typecheck && npm run lint && npm test` en verde, y además `npm run build` al final de cada workstream.
- **Commits:** chicos, uno por tarea como mínimo, en inglés con prefijo convencional (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`), terminando con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Prisma 7:** `@prisma/client` + adapter mariadb, vía `src/lib/db.ts`. Los IDs son `cuid()`.

---

## 5. Contratos entre workstreams

Estas firmas son **fijas**. Si un workstream necesita cambiarlas, se coordina con el orquestador antes. Los archivos los crea el workstream indicado como "dueño". Cuando un consumidor arranca antes, el dueño de W0 deja un **stub** con la firma correcta.

### 5.1 Tiempo — `src/lib/time/index.ts` (dueño W0-A)
```ts
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
export type LocalDate = string;  // "YYYY-MM-DD"
export type WeekKey = string;    // "YYYY-MM-DD" del lunes local
export function localDateOf(instant: Date, tz: string): LocalDate;
export function weekKeyOf(instant: Date, tz: string): WeekKey;
export function weekKeyOfLocalDate(date: LocalDate): WeekKey;
export function addDays(date: LocalDate, n: number): LocalDate;
export function addWeeks(week: WeekKey, n: number): WeekKey;
export function weekKeysBetween(start: LocalDate, end: LocalDate): WeekKey[]; // inclusivo
export function daysInWeekWithin(week: WeekKey, start: LocalDate, end: LocalDate): number; // 0..7
export function zonedToUtc(date: LocalDate, time: string /* "HH:mm" */, tz: string): Date;
export function localTimeOf(instant: Date, tz: string): string; // "HH:mm"
export function formatDate(instant: Date, tz: string, style?: "short" | "long"): string;   // es-AR
export function formatDateTime(instant: Date, tz: string): string;                          // es-AR
export function formatLocalDate(date: LocalDate, style?: "short" | "long"): string;
export function formatDuration(minutes: number): string; // "45 min", "1 h 10 min"
export function dbDateToLocalDate(d: Date): LocalDate;   // para columnas @db.Date
export function localDateToDbDate(d: LocalDate): Date;
```

### 5.2 Auth — `src/server/auth/dal.ts` (dueño W0-A)
```ts
export type SessionUser = { id: string; email: string; name: string | null; photoUrl: string | null; timezone: string };
export const getSession: () => Promise<SessionUser | null>;          // React cache()
export async function requireUser(): Promise<SessionUser>;           // lanza AuthError("UNAUTHENTICATED") — para Server Actions y route handlers
export async function requirePageUser(): Promise<SessionUser>;       // redirect("/login?next=…") — para Server Components/páginas
export async function requireGroupMember(groupId: string): Promise<{ user: SessionUser; role: "admin" | "member" }>; // lanza FORBIDDEN/NOT_FOUND
export async function requireGroupAdmin(groupId: string): Promise<SessionUser>;
export class AuthError extends Error { constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND") }
```

### 5.3 Resultado de acciones — `src/server/http/result.ts` (dueño W0-A)
```ts
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
export function ok<T>(data: T, message?: string): ActionResult<T>;
export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never>;
export function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown):
  { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> };
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>>; // atrapa AuthError/Prisma → mensaje es-AR
```

### 5.4 Actividades — `src/server/activities/*` (dueño W0-C)
```ts
// src/schemas/workout.ts
export const setInputSchema;          // { kind, reps?, durationSeconds?, weightKg?, restSeconds?, completed }
export const exerciseEntryInputSchema; // { exerciseId, notes?, sets: SetInput[] (≥1) }
export const activityInputSchema;      // { clientRequestId, activityCategoryId, localDate, localTime, durationMinutes, notes?, routineId?, exercises: ExerciseEntryInput[] (puede ser vacío) }
export type ActivityInput = z.infer<typeof activityInputSchema>;

// src/server/activities/service.ts
export async function createActivity(userId: string, input: ActivityInput): Promise<{ activityId: string; effects: ActivityEffects }>;
export async function updateActivity(userId: string, activityId: string, input: ActivityInput): Promise<{ effects: ActivityEffects }>;
export async function deleteActivity(userId: string, activityId: string): Promise<{ effects: ActivityEffects }>;
export async function getActivityForEdit(userId: string, activityId: string): Promise<ActivityInput & { id: string }>;

// src/server/activities/effects.ts
export type ActivitySnapshot = { id: string; userId: string; activityCategoryId: string; startedAt: Date; durationMinutes: number };
export type ActivityChange = { userId: string; before: ActivitySnapshot | null; after: ActivitySnapshot | null };
export type ActivityEffects = { scoring: ScoringEffect[]; badges: BadgeChange[] };
export async function runActivityEffects(change: ActivityChange): Promise<ActivityEffects>;
// llama, en orden: recomputeSeasonsForChange (W1-1) → recomputeUserBadges (W1-2) → emitActivityNotifications (W2-3)
```

### 5.5 Puntos y temporadas — `src/server/scoring/*` (dueño W1-1; stubs en W0-C)
```ts
// src/server/scoring/types.ts
export type ScoringEffect = {
  seasonId: string; seasonName: string; groupId: string; groupName: string;
  activityPoints: number;            // puntos de ESTA actividad (0 si no puntuó)
  activityReason: string | null;     // "Ya sumaste un entrenamiento hoy", etc.
  totalBefore: number; totalAfter: number;
  rankBefore: number | null; rankAfter: number;
};
// src/server/scoring/recompute.ts
export async function recomputeSeason(seasonId: string): Promise<void>;
export async function recomputeSeasonsForChange(change: ActivityChange): Promise<ScoringEffect[]>;
export async function finalizeSeason(seasonId: string, opts: { publish: boolean }): Promise<void>; // idempotente
// src/server/scoring/queries.ts
export async function getSeasonStandings(seasonId: string): Promise<StandingRow[]>;
export async function getActivityPoints(activityIds: string[]): Promise<Map<string, { seasonId: string; points: number; reason: string | null }[]>>;
export type StandingRow = { userId: string; name: string | null; photoUrl: string | null; rank: number; points: number; daysTrained: number; activities: number; weeksGoalMet: number; currentStreak: number; bestStreak: number; minutes: number };
```

### 5.6 Insignias — `src/server/badges/*` (dueño W1-2; stub en W0-C)
```ts
export type BadgeChange = { code: string; name: string; iconKey: string | null; levelBefore: number; levelAfter: number; progressBefore: number; progressAfter: number; nextThreshold: number | null };
export async function recomputeUserBadges(userId: string): Promise<BadgeChange[]>; // solo las que cambiaron
export async function getUserBadges(userId: string): Promise<UserBadgeView[]>;
export type UserBadgeView = { code: string; name: string; description: string; iconKey: string | null; level: number; maxLevel: number; progress: number; nextThreshold: number | null; achievedAt: Date | null };
```

### 5.7 Ejercicios — `src/features/exercises/*` (dueño W1-3)
```ts
export type ExerciseSummary = { id: string; name: string; nameEn: string | null; measureType: "reps" | "duration"; equipment: Equipment; tracksWeight: boolean; primaryGroupKey: string | null; mediaUrl: string | null };
export function ExercisePicker(props: { open: boolean; onClose(): void; onConfirm(exercises: ExerciseSummary[]): void; multiple?: boolean }): JSX.Element;
export function ExerciseInfoButton(props: { exerciseId: string }): JSX.Element; // botón "?" + diálogo
export function useExerciseCatalog(): { catalog: ExerciseSummary[]; loading: boolean; refresh(): void };
export function searchExercises(catalog: CatalogEntry[], query: string, filters: { groupKey?: string; equipment?: Equipment }): CatalogEntry[];
```

### 5.8 Medios — `src/features/media/*` + `src/server/media/*` (dueño W1-5)
```ts
export type UploadTarget = { kind: "activity"; activityId: string } | { kind: "avatar" } | { kind: "group"; groupId: string };
export function PhotoUploader(props: { target: UploadTarget; onUploaded(media: { id?: string; url: string }): void; multiple?: boolean; max?: number }): JSX.Element;
export function PendingPhotoPicker(props: { value: File[]; onChange(files: File[]): void; max?: number }): JSX.Element; // para el formulario antes de que exista la actividad
export async function uploadPendingPhotos(activityId: string, files: File[]): Promise<void>; // cliente, después de crear la actividad
```

### 5.9 UI — `src/components/ui/*` y `src/components/shell/*` (dueño W0-B)
`Button` (`variant: primary|secondary|ghost|danger`, `size: sm|md|lg`, `pending`, `asChild` no), `LinkButton`, `IconButton`, `Card`, `StatCard`, `Avatar`, `Chip`, `Badge`(pill), `EmptyState`, `PageHeader`, `Field`, `Input`, `Textarea`, `Select`, `NumberInput`, `Slider`, `Switch`, `Tabs`, `Sheet` (bottom sheet), `Modal`, `ConfirmDialog` + `useConfirm()`, `Toaster` + `toast` (`success|error|info`), `Skeleton`, `Spinner`, `ProgressBar`. Shell: `AppShell`, `TopBar`, `BottomNav`, `nav-items.ts`.

### 5.10 Notificaciones — `src/server/notifications/*` (dueño W2-3; stub en W0-C)
```ts
export async function emitActivityNotifications(change: ActivityChange, effects: ActivityEffects): Promise<void>;
export async function notify(input: { recipientIds: string[]; type: NotificationType; actorId?: string; groupId?: string; seasonId?: string; activityId?: string; data?: Record<string, unknown>; dedupeKey: (recipientId: string) => string }): Promise<void>;
```

---

## 6. Olas de ejecución y paralelismo

```
Ola 0 ─┬─ W0-A Base técnica (backend) ─┐
       └─ W0-B Base UI ────────────────┴─► W0-C Schema v2 + servicio de actividades
Ola 1 (en paralelo, después de W0-C):
       W1-1 Motor de puntos/temporadas │ W1-2 Insignias │ W1-3 Catálogo de ejercicios │ W1-4 Cuentas y social │ W1-5 Medios R2
Ola 2 (en paralelo, después de la Ola 1):
       W2-1 Entrenamientos y rutinas (Strong) │ W2-2 Temporadas y grupo │ W2-3 Notificaciones │ W2-4 Home, perfil y stats
Ola 3: W3 Endurecimiento, E2E, deploy y release (web + PWA)
Ola 4 (después del release web): W4 App nativa con Capacitor (APK Android + push nativo + widget de amigos; iOS opcional)
```

- **Máximo paralelismo:** 2 agentes en Ola 0 (más 1 secuencial), 5 en Ola 1 y 4 en Ola 2.
- **W0-C es el cuello de botella a propósito:** concentra **todos** los cambios de schema de v2 en una sola migración, así las olas siguientes no tocan `schema.prisma` ni crean migraciones.
- **Si un workstream necesita una columna nueva**, la pide al orquestador, que agrega una migración pequeña en `rework/v2` y avisa al resto.

### 6.1 Ramas, worktrees y bases de datos

- **Rama de integración:** `rework/v2` (sale de `chore/local-dev-setup`). Cada workstream trabaja en su propio worktree, en la rama `v2/<id>` (por ejemplo `v2/w1-1-scoring`) creada desde `rework/v2` actualizada.
- **Base de datos por worktree:** `npm run db:worktree -- <id>` (lo crea W0-A) crea `elbravo_<id>` y `elbravo_<id>_test` y escribe `.env.local` en el worktree con esas URLs y un `PORT` propio.
- **Puertos de dev server:** 3000 queda para la integración. Los workstreams usan W0-A=3001, W0-B=3002, W0-C=3003, W1-1..5=3011..3015 y W2-1..4=3021..3024.
- **Merge:** al terminar, el orquestador revisa (con `superpowers:requesting-code-review`), mergea a `rework/v2` con `--no-ff` y corre `typecheck`, `lint`, `test` y `build` en la rama de integración antes de habilitar la ola siguiente.
- **Orden de merge dentro de la Ola 1:** W1-1 → W1-2 → W1-3 → W1-5 → W1-4. Es el orden de menor riesgo de conflicto en `effects.ts`/stubs.
- **Orden de merge dentro de la Ola 2:** W2-1 → W2-2 → W2-4 → W2-3.

### 6.2 Propiedad de archivos (para evitar conflictos)

| Workstream | Es dueño de (crea/modifica libremente) |
|---|---|
| W0-A | `package.json` (scripts/devDeps), `vitest.config.ts`, `tests/setup/*`, `scripts/*` (de infraestructura), `src/lib/time/**`, `src/server/auth/**`, `src/server/http/**`, `proxy.ts`, `next.config.ts`, `eslint.config.mjs`, fixes puntuales para que el build compile |
| W0-B | `app/globals.css`, `app/layout.tsx`, `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/manifest.ts`, `public/icons/**`, `public/sw.js` (versión base; W2-3 agrega push), `scripts/pwa/**`, `src/components/ui/**`, `src/components/shell/**` |
| W0-C | `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed/**`, `scripts/migrate-v2-data.ts`, `src/schemas/workout.ts`, `src/server/activities/**`, stubs en `src/server/{scoring,badges,notifications}/index.ts` |
| W1-1 | `src/server/scoring/**`, `src/server/seasons/**`, `src/server/actions/seasons.ts`, `app/api/cron/seasons/**` |
| W1-2 | `src/server/badges/**`, `prisma/seed/badges.ts`, `src/features/badges/**` |
| W1-3 | `src/features/exercises/**`, `src/server/exercises/**`, `src/server/actions/exercises.ts`, `prisma/seed/exercises.ts`, `prisma/seed/data/**`, `scripts/exercises/**` |
| W1-4 | `src/server/social/**`, `src/server/account/**`, `src/server/groups/**`, `src/server/actions/{social,account,groups}.ts`, `app/u/**`, `app/settings/**`, `src/features/profile/ProfileView.tsx` (versión inicial) |
| W1-5 | `src/server/media/**`, `src/features/media/**`, `src/server/actions/media.ts`, `scripts/migrate-images-to-r2.ts` |
| W2-1 | `src/features/workout/**`, `src/server/actions/{activities,routines}.ts`, `src/server/routines/**`, `app/workout/**`, `app/routines/**` |
| W2-2 | `app/group/**`, `app/groups/**`, `src/features/group/**`, `src/features/season/**` |
| W2-3 | `src/server/notifications/**`, `src/server/actions/notifications.ts`, `src/features/notifications/**`, `app/notifications/**`, `app/api/cron/notifications/**`, `src/emails/**` |
| W2-4 | `app/home/**`, `app/profile/**`, `app/stats/**`, `src/features/profile/**`, `src/features/stats/**`, `src/server/stats/**` |
| W3 | `e2e/**`, `playwright.config.ts`, `README.md`, `docs/**`, `vercel.json` |
| W4 | `mobile/**` (proyecto Capacitor y código nativo), `capacitor.config.ts`, `app/api/widget/**`, `app/api/devices/**`, `src/server/devices/**` |

**Archivos compartidos de bajo riesgo:** se editan solo para **agregar** entradas y el orquestador resuelve los conflictos triviales. Son `next.config.ts` (redirects), `src/components/shell/nav-items.ts`, `.env.example` y `package.json` (dependencias).

**Borrar código viejo:** cada workstream borra los `app/api/*`, páginas y componentes viejos **de su dominio** cuando su reemplazo está listo (ver cada plan).

### 6.3 Rutas finales de la app

| Ruta | Dueño | Reemplaza |
|---|---|---|
| `/home` | W2-4 | — |
| `/workout/new`, `/workout/[id]`, `/workout/[id]/edit` | W2-1 | `/load` |
| `/routines`, `/routines/new`, `/routines/[id]/edit`, `/routines/[id]/live` | W2-1 | `/routine`, `/create-routine`, `/routine/[id]/edit` |
| `/groups`, `/groups/new`, `/group/[id]`, `/group/[id]/settings`, `/group/[id]/season/new`, `/group/[id]/season/[seasonId]`, `/group/[id]/season/[seasonId]/edit` | W2-2 | `/create-group`, `/group/[id]/edit`, `/group/[id]/create-season`, `/group`, `/group/edit`, `/dashboard` |
| `/u/[id]` | W1-4 (W2-4 rediseña `ProfileView`) | — |
| `/profile` | W2-4 (= `ProfileView` propio) | — |
| `/settings`, `/settings/password`, `/settings/notifications` | W1-4 (+ W2-3 la de notificaciones) | `/profile/edit` |
| `/stats` | W2-4 | — |
| `/notifications` | W2-3 | — |
| `/api/widget/feed`, `/api/devices` | W4 | — |

**Navegación inferior** (W0-B la crea; cada workstream activa su ítem en `nav-items.ts`): Inicio · Grupos · **＋ Registrar** (botón central) · Stats · Perfil. La **barra superior** tiene el logo y una campana (W2-3).

---

## 7. Índice de planes

| Archivo | Workstream | Ola | Depende de |
|---|---|---|---|
| `W0-A-base-tecnica.md` | Tests, build verde, tiempo, auth, acciones, tooling | 0 | — |
| `W0-B-base-ui.md` | Tokens, primitivas, shell, modo oscuro | 0 | — |
| `W0-C-schema-v2.md` | Schema v2, migración de datos, servicio de actividades | 0 | W0-A |
| `W1-1-puntos-temporadas.md` | Motor de puntos, temporadas, premios, finalización | 1 | W0-C |
| `W1-2-insignias.md` | Insignias con niveles, recálculo, diff | 1 | W0-C |
| `W1-3-catalogo-ejercicios.md` | Catálogo, info "?", alias, búsqueda, crear ejercicio | 1 | W0-B, W0-C |
| `W1-4-cuentas-social.md` | Seguir, perfil ajeno, contraseña, seguridad de grupos | 1 | W0-B, W0-C |
| `W1-5-medios-r2.md` | Subida de fotos a R2, migración de imágenes | 1 | W0-B, W0-C |
| `W2-1-entrenamientos-rutinas.md` | Registro tipo Strong, modo en vivo, editar, post-entreno | 2 | W1-1, W1-2, W1-3, W1-5 |
| `W2-2-temporadas-grupo.md` | Página de grupo, wizard de temporada, sliders, final | 2 | W1-1, W1-4 |
| `W2-3-notificaciones.md` | Feed, campana, email | 2 | W1-1, W1-2, W1-4 |
| `W2-4-home-perfil-stats.md` | Home, perfil, stats | 2 | W1-1, W1-2, W1-4 |
| `W3-release.md` | E2E, DB de producción, deploy | 3 | todo |
| `W4-app-movil.md` | Capacitor Android, push nativo, widget de amigos, iOS opcional | 4 | W3 |

## 8. Decisiones (estado al 31-oct)

Ya resueltas:
- **D1 puntos:** aprobada, con la curva decreciente y los días fusionados.
- **D5 seguir + reacciones:** aprobada.
- **D6 dataset abierto de imágenes:** aprobada.
- **D12 web → PWA → Capacitor:** dirección aprobada.

Pendientes:
1. **D8 Cloudflare R2:** crear la cuenta (gratis). Bloquea solo la verificación real de W1-5; se desarrolla con MinIO.
2. **D9 Dominio para email:** postergado. No bloquea nada: el email queda apagado.
3. **D13 DB de producción:** confirmar en la consola de Aiven si `el-bravo-prod` tiene datos y elegir hosting nuevo. Bloquea W3.
4. **D12 iOS:** decidir si se paga Apple Developer (USD 99 por año) para distribuir por TestFlight. Bloquea solo la parte iOS de W4.
