# W2-3 — Notificaciones: feed, campana y email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D9, §4, §5.10, §6.2).

**Goal:** que los usuarios se enteren de lo que pasa en sus grupos con mensajes motivadores, por ejemplo:
- "Manu fue el primero en arrancar la semana"
- "Lucio cumplió su semana"
- "Te pasaron en el ranking"
- "Subiste a Gym Rat II"
- "Se publicaron los resultados"

Las notificaciones aparecen en la home ("Novedades"), en una campana con contador y, de forma opcional, por email: al instante para algunos tipos, o en un resumen semanal.

**Architecture:**
- **Generación:** reglas puras en `src/server/notifications/rules.ts`. Reciben el cambio de actividad, los efectos y el contexto del grupo, y deciden qué notificaciones emitir.
- **Escritura:** `notify()` escribe en `Notification` con un `dedupeKey`, así cada notificación es idempotente.
- **Envío de emails:** un cron procesa el outbox (filas con `emailedAt = null` permitidas por preferencias) y envía con Resend.

**Tech Stack:** Prisma, Resend (`resend` SDK), Server Actions, primitivas UI.

**Spec:** `00-roadmap.md` (D9). **Depende de:** W1-1, W1-2 y W1-4. **Rama:** `v2/w2-3-notifications`. Puerto 3023.

## Global Constraints
Ver `00-roadmap.md` §4. **Una notificación nunca rompe un guardado:** `runActivityEffects` ya envuelve el emisor en try/catch.

---

### Task 1: Reglas de emisión (puras) + `notify`

**Files:**
- Create: `src/server/notifications/rules.ts`
- Create: `src/server/notifications/notify.ts`
- Create: `src/server/notifications/emit.ts` (implementa `emitActivityNotifications`, `emitSeasonPublished`, `emitSeasonStarted`)
- Modify: `src/server/notifications/index.ts` (reemplaza los stubs; mantiene los exports)
- Test: `src/server/notifications/rules.test.ts`, `src/server/notifications/emit.int.test.ts`

**Interfaces:**
- Produce:

```ts
export type RuleContext = {
  actor: { id: string; name: string };
  groups: { groupId: string; groupName: string; memberIds: string[]; weekKey: string; actorWorkoutsThisWeek: number; othersWithWorkoutThisWeek: number; weeklyGoal: number }[];
  effects: ActivityEffects; // ScoringEffect[] incluye rankBefore/After por temporada
  isNewActivity: boolean;
};
export type PlannedNotification = { recipientIds: string[]; type: NotificationType; actorId: string; groupId?: string; seasonId?: string; activityId?: string; data: Record<string, unknown>; dedupe: (recipientId: string) => string };
export function planActivityNotifications(ctx: RuleContext, activityId: string): PlannedNotification[];
export function renderNotification(type: NotificationType, data: Record<string, unknown>, viewerId: string): { title: string; body?: string; href: string; icon: string };
```

Reglas (solo para actividades **nuevas**, no al editar ni al borrar). Cada una tiene su test:

| Tipo | Cuándo | A quién | dedupeKey |
|---|---|---|---|
| `first_workout_of_week` | El actor registra su primer entrenamiento puntuable de la semana del grupo y ningún otro miembro tiene uno esa semana | Otros miembros del grupo | `first_week:<groupId>:<weekKey>:<recipient>` |
| `weekly_goal_met` | `actorWorkoutsThisWeek` pasa a ser igual a `weeklyGoal` | Otros miembros del grupo | `goal:<groupId>:<weekKey>:<actorId>:<recipient>` |
| `streak_milestone` | La racha del actor en una temporada llega a 3, 5 o 10 (de los efectos/standings) | Otros miembros | `streak:<seasonId>:<actorId>:<n>:<recipient>` |
| `rank_overtaken` | Por cada miembro con `rank` antes < `rank` del actor antes y `rank` después > `rank` del actor después (fue pasado) | Esos miembros | `overtaken:<seasonId>:<actorId>:<recipient>:<weekKey>` (como máximo 1 por semana por par) |
| `badge_level_up` | Un `BadgeChange` con `levelAfter > levelBefore` | El actor (para el historial) y sus seguidores | `badge:<actorId>:<code>:<level>:<recipient>` |

`renderNotification` arma el texto en es-AR:
- "🔥 **Manu** fue el primero en arrancar la semana en *Los Bravos*"
- "✅ **Lucio** cumplió su objetivo semanal"
- "⚡ **Leo** lleva 5 semanas seguidas"
- "📉 **Manu** te pasó en *Temporada Verano*. ¡A entrenar!"
- "🏅 **Lucio** subió a *Gym Rat II*"
- "🏆 Se publicaron los resultados de *Temporada Verano*"
- "👋 **Ana** empezó a seguirte"
- "🙌 **Ana** se unió a *Los Bravos*"

El `href` lleva al lugar correspondiente: el grupo, la temporada o el perfil.

Además:
- `notify()` hace `createMany({ skipDuplicates: true })` y respeta `NotificationPreference.inApp`: si es `false`, la notificación no se crea.
- `emitActivityNotifications` arma el contexto con las queries necesarias (miembros, conteos de la semana en la zona horaria de cada grupo) y llama a `planActivityNotifications` y `notify`.
- `emitSeasonPublished` se cablea en `publishSeasonResultsAction` y en `finalizeSeason` con `publish`. `emitSeasonStarted` se cablea en el cron de temporadas de W1-1, cuando llega `startDate`. Agregar el cálculo "temporadas que empiezan hoy" al cron, coordinado con el orquestador porque el archivo es de W1-1, o hacer un cron propio `app/api/cron/notifications` que también lo cubra (**recomendado**, para no tocar archivos de W1-1).
- Llamar a `notify` también desde `followAction` (`new_follower`) y `joinGroupAction` (`member_joined`). Si W1-4 ya dejó esas llamadas al stub, no hay que tocar nada.

- [ ] **Step 1:** tests puros de cada regla (casos positivos y negativos, por ejemplo que editar no notifica) y de `renderNotification`.
- [ ] **Step 2:** tests de integración:
  - 2 usuarios en un grupo; el primero en entrenar el lunes notifica al otro;
  - un segundo entrenamiento esa semana no vuelve a notificar;
  - registrar dos veces lo mismo (`dedupe`) no duplica;
  - `inApp=false` no crea la notificación.
- [ ] **Step 3:** implementar.
- [ ] **Step 4: Commit**

```bash
git add src/server/notifications
git commit -m "feat(notifications): rule-based, idempotent in-app notifications"
```

---

### Task 2: UI: campana, `/notifications` y "Novedades" en la home

**Files:**
- Create: `src/server/actions/notifications.ts`: `listNotificationsAction(cursor?)`, `markAllReadAction()`, `markReadAction(id)` y `unreadCountAction()`
- Create: `src/features/notifications/NotificationBell.tsx` (ícono + contador; abre un `Sheet` con las últimas 10 y "Ver todas")
- Create: `src/features/notifications/NotificationItem.tsx`
- Create: `src/features/notifications/HomeFeed.tsx` (sección "Novedades" para la home: las últimas 5, agrupadas por día; W2-4 la monta en la home)
- Create: `app/notifications/page.tsx` (lista paginada con "Marcar todas como leídas")
- Modify: `src/components/shell/TopBar.tsx`: pasar `rightSlot={<NotificationBell initialCount={…} />}`. La cuenta inicial sale del layout con una query server-side `unreadCount(userId)` (excepción acordada: es un cambio de 2 líneas en `app/layout.tsx`, que el orquestador revisa).

Comportamiento:
- El contador se actualiza al navegar (Server Component) y con un poll liviano cada 60 s solo mientras la pestaña está visible (`document.visibilityState`).
- Las no leídas se ven con un punto lima y `bg-surface-2`.
- Al tocar una notificación, se marca como leída y navega a su `href`.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** verificar con 2 navegadores: entrenar con A hace que la campana de B muestre 1 (al navegar o en ≤ 60 s); tocar marca leída y lleva al grupo.
- [ ] **Step 3: Commit**

```bash
git add src/server/actions/notifications.ts src/features/notifications app/notifications src/components/shell/TopBar.tsx app/layout.tsx
git commit -m "feat(notifications): bell, notifications page and home feed section"
```

---

### Task 3: Preferencias y email (Resend)

**Files:**
- Create: `app/settings/notifications/page.tsx` + `src/features/notifications/PreferencesForm.tsx` (por tipo: Switch "En la app" y Switch "Por email"; más "Resumen semanal por email" on/off)
- Create: `src/emails/render.ts` (HTML simple inline, sin librería de templates: un layout + el bloque de la notificación + el link)
- Create: `src/server/notifications/email.ts` (`sendPendingEmails(now)` y `sendWeeklyDigests(now)`)
- Create: `app/api/cron/notifications/route.ts` (protegido con `CRON_SECRET`; corre `sendPendingEmails`, los lunes a las 9:00 AR `sendWeeklyDigests` y `emitSeasonStarted` para las temporadas que empiezan hoy)
- Modify: `.env.example` (`RESEND_API_KEY`, `EMAIL_FROM="El Bravo <hola@<dominio>>"`, `APP_URL`)
- Modify: `app/settings/page.tsx` (habilitar el ítem "Notificaciones")
- Test: `src/server/notifications/email.int.test.ts` (Resend mockeado)

Reglas:
- **Email instantáneo:** solo para los tipos con `email=true` en las preferencias. Por defecto **todos están en `false`**, salvo `season_results_published` y `new_follower`, que van en `true`. Esa es la decisión D9 y se puede ajustar.
- **Resumen semanal:**
  - Si está activo (por defecto sí), incluye las posiciones del usuario en sus temporadas activas, cuántos entrenamientos hizo y las novedades de la semana.
  - Se manda solo si hubo actividad.
  - Cada envío se registra como una `Notification` de tipo `weekly_digest` (el enum lo incluye desde W0-C), con `dedupeKey` `digest:<userId>:<weekKey>` y `emailedAt` seteado. **No se muestra en el feed in-app**: filtrar `type != weekly_digest` en las queries de la UI.
- **Sin `RESEND_API_KEY`:** el cron loguea "email deshabilitado" y no falla.
- **Cada email incluye un link "Dejar de recibir estos emails"** que lleva a `/settings/notifications` (requiere login; alcanza para la escala actual).

- [ ] **Step 1:** verificar que `NotificationType` incluya `weekly_digest` (lo agrega W0-C).
- [ ] **Step 2:** tests:
  - con preferencias por defecto, solo se envía lo permitido;
  - `emailedAt` se setea y no se reenvía;
  - si Resend falla, `emailedAt` no se setea y se reintenta en la próxima corrida;
  - sin API key no falla.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verificación manual. Con una API key de Resend en modo test (si D9 está confirmada), llamar a `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3023/api/cron/notifications` y revisar el email recibido. Sin key, revisar el HTML generado con `npx tsx scripts/dev/preview-email.ts > /tmp/x.html`.
- [ ] **Step 5: Commit**

```bash
git add -A app/settings app/api/cron/notifications src/emails src/server/notifications src/features/notifications .env.example scripts/dev
git commit -m "feat(notifications): preferences, instant emails and weekly digest via Resend"
```

---

### Verificación final de W2-3
- [ ] Ítems cubiertos: 5 y 20.
- [ ] Gates verdes. Pedir review y merge (es el último de la Ola 2).
