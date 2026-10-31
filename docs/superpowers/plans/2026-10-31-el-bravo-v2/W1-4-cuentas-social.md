# W1-4 — Cuentas, social y seguridad de grupos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D5, §4, §5.2–5.3, §6.2–6.3).

**Goal:** que los usuarios puedan seguirse ("amigos" = seguimiento mutuo), reaccionar a entrenamientos, ver un feed de sus amigos, invitarlos a grupos sin código, ver el perfil de otros, cambiar su contraseña y editar su cuenta en `/settings`. Además se cierran los agujeros de seguridad de sesiones y grupos.

**Architecture:**
- Lógica en `src/server/{social,account,groups}`.
- Server Actions en `src/server/actions/{social,account,groups}.ts`.
- Páginas `/u/[id]` y `/settings/*`.
- La sesión pasa a ser revocable con `User.tokenVersion` (la columna ya existe desde W0-C).

**Tech Stack:** Prisma, `bcryptjs`, `jose`, `node:crypto`, primitivas UI de W0-B.

**Spec:** `00-roadmap.md` (D5). **Depende de:** W0-B y W0-C. **Rama:** `v2/w1-4-social`. Puerto 3014. Preparar la DB con `npm run db:worktree -- w1-4 3014`.

## Global Constraints
Ver `00-roadmap.md` §4.

---

### Task 1: Sesiones revocables + login/registro como Server Actions

**Files:**
- Modify: `src/server/auth/dal.ts`: `getSession` compara `ver` del token contra `user.tokenVersion` (si no coincide, `null`).
- Create: `src/server/account/passwords.ts` (`hashPassword` y `verifyPassword` con bcryptjs, costo 12)
- Create: `src/server/account/rate-limit.ts`: limitador en memoria por clave (`ip:email`), con ventana deslizante. Se exporta `rateLimit(key, { max, windowMs }): { ok: boolean; retryAfterS: number }`. Documentado como "por instancia; suficiente para la escala actual".
- Create: `src/server/actions/account.ts` con `loginAction`, `registerAction`, `logoutAction`, `changePasswordAction`, `updateProfileAction` y `logoutEverywhereAction`.
- Modify: `app/login/page.tsx`, `app/register/page.tsx`: usan las acciones con `useActionState` + `<Button pending>`, respetan `?next=` y muestran los errores por campo con `<Field error>`.
- Delete: `app/api/auth/login`, `app/api/auth/register`, `app/api/auth/logout`, `app/api/auth/me` (antes, buscar con grep a sus consumidores; `GroupPageClient` usa `/api/auth/me`: pasarle `currentUserId` por props, que ya lo tiene), `app/api/profile/update`, `src/components/LogoutButton.tsx` (se reemplaza por un botón en `/settings`).
- Modify: `proxy.ts`: saca `/api/auth/*` de las rutas públicas (ya no existen).
- Test: `src/server/account/*.test.ts`, `src/server/actions/account.int.test.ts`

**Interfaces:**
- Produce:

```ts
export async function loginAction(prev: unknown, form: FormData): Promise<ActionResult<{ next: string }>>;      // email, password, next
export async function registerAction(prev: unknown, form: FormData): Promise<ActionResult<{ next: string }>>;   // name, email, password (≥8)
export async function logoutAction(): Promise<void>;                                                            // redirect("/login")
export async function changePasswordAction(input: { currentPassword: string; newPassword: string }): Promise<ActionResult<void>>;
export async function logoutEverywhereAction(): Promise<ActionResult<void>>;
export async function updateProfileAction(input: { name: string; bio?: string | null; weeklyGoal: number; timezone: string; photoUrl?: string | null }): Promise<ActionResult<void>>;
```

Reglas (cada una con test):
- **Login:**
  - Hace como máximo 5 intentos por `ip:email` cada 15 min. Al superarlo responde "Demasiados intentos. Probá de nuevo en N minutos."
  - Si falla, el mensaje es siempre "Email o contraseña incorrectos.", sin revelar cuál de los dos está mal.
  - Si el usuario está inactivo, da el mismo error.
- **Registro:**
  - Valida el formato del email y lo normaliza a minúsculas. Exige una contraseña de al menos 8 caracteres y un nombre de 2 a 80.
  - Si el email ya existe, responde "Ya hay una cuenta con ese email."
  - Al terminar inicia sesión automáticamente.
- **Cambio de contraseña:**
  - Verifica la contraseña actual. La nueva tiene que ser distinta y de al menos 8 caracteres.
  - Incrementa `tokenVersion` y vuelve a emitir la cookie con el `ver` nuevo: la sesión actual sigue y las demás se cierran.
  - Responde "Contraseña actualizada. Cerramos tus otras sesiones."
- **`logoutEverywhereAction`:** incrementa `tokenVersion` y borra la cookie.
- **`updateProfileAction`:**
  - `timezone` tiene que ser una zona válida según `Intl.supportedValuesOf("timeZone")`.
  - `weeklyGoal` va de 1 a 7. Se unifica con el rango de las temporadas, que antes era de 1 a 14.
  - El email **no** se edita: se elimina del formulario, porque antes se ignoraba en silencio.
  - Si `weeklyGoal` cambia, se llama a `recomputeUserBadges(userId)`, porque `IMPARABLE` depende de ese objetivo.

- [ ] **Step 1:** tests unitarios de `rateLimit` (ventana, `max` y `retryAfter`) y de `hash`/`verify`.
- [ ] **Step 2:** tests de integración de las acciones. Mockear `cookies()` con un `Map` en memoria y `headers()` para la IP.
- [ ] **Step 3:** implementar.
- [ ] **Step 4: Verificación manual**
  - Registrarse y verificar que la navbar aparece sin recargar (corrige el bug del navbar ausente).
  - Al sexto login fallido aparece el mensaje de bloqueo.
  - Al cambiar la contraseña, la otra sesión (otro navegador) cae a `/login` en el próximo request.
- [ ] **Step 5: Commit**

```bash
git add -A src/server/auth src/server/account src/server/actions/account.ts app/login app/register app/api/auth app/api/profile src/components/LogoutButton.tsx proxy.ts
git commit -m "feat(account): revocable sessions, rate-limited login and password change"
```

---

### Task 2: `/settings`

**Files:**
- Create: `app/settings/page.tsx` (menú: Perfil, Contraseña, Notificaciones (W2-3 habilita el ítem), Cerrar sesión, Cerrar sesión en todos lados)
- Create: `app/settings/profile/page.tsx` + `src/features/account/EditProfileForm.tsx`
- Create: `app/settings/password/page.tsx` + `src/features/account/ChangePasswordForm.tsx`
- Delete: `app/profile/edit/page.tsx`, `src/components/EditProfileForm.tsx`
- Modify: `next.config.ts`: agregar el redirect `/profile/edit` → `/settings/profile`.

**Diseño:**
- `PageHeader` con `back`.
- Formularios con `Field`, `Input`, `NumberInput` (objetivo semanal de 1 a 7) y `Select` de zona horaria. El select muestra primero una lista corta (Argentina, Uruguay, Chile, España, México, UTC) y después "Otra…".
- La foto: si W1-5 ya está mergeado, usa `PhotoUploader target={{ kind: "avatar" }}`. Si no, un `Input` de URL con el comentario `// TODO(W1-5): reemplazar por PhotoUploader`. El orquestador lo resuelve al integrar.
- Cerrar sesión pide confirmación con `useConfirm` y "Cerrar sesión en todos lados" con `danger`.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** verificar en 375 px: los errores se ven por campo, el botón queda en pending durante el guardado y aparece un toast de éxito.
- [ ] **Step 3: Commit**

```bash
git add -A app/settings src/features/account app/profile/edit src/components/EditProfileForm.tsx next.config.ts
git commit -m "feat(settings): profile, password and session settings pages"
```

---

### Task 3: Seguir usuarios + perfil ajeno

**Files:**
- Create: `src/server/social/follows.ts`
- Create: `src/server/social/profile.ts`
- Create: `src/server/actions/social.ts`
- Create: `src/features/profile/ProfileView.tsx` (versión inicial; W2-4 la rediseña)
- Create: `src/features/social/FollowButton.tsx`
- Create: `src/features/social/UserSearch.tsx` (buscar personas por nombre)
- Create: `app/u/[id]/page.tsx`
- Create: `app/u/[id]/followers/page.tsx`, `app/u/[id]/following/page.tsx`
- Test: `src/server/social/*.int.test.ts`

**Interfaces:**
- Produce:

```ts
export async function followAction(userId: string): Promise<ActionResult<{ isFollowing: true; isFriend: boolean }>>;
export async function unfollowAction(userId: string): Promise<ActionResult<{ isFollowing: false }>>;
export async function searchUsersAction(query: string): Promise<ActionResult<{ id: string; name: string | null; photoUrl: string | null; isFollowing: boolean }[]>>;
export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile | null>;
export type PublicProfile = {
  user: { id: string; name: string | null; photoUrl: string | null; bio: string | null; createdAt: Date };
  counts: { followers: number; following: number; workouts: number };
  relation: { isMe: boolean; isFollowing: boolean; followsMe: boolean; isFriend: boolean };
  sharedGroups: { id: string; name: string }[];
  recentActivities: { id: string; categoryName: string; startedAt: Date; durationMinutes: number; photoUrl: string | null }[]; // últimas 10
};
export function ProfileView(props: { profile: PublicProfile; badges: UserBadgeView[]; viewerTz: string }): JSX.Element;
```

Reglas:
- No se puede seguir a uno mismo.
- Seguir dos veces es idempotente.
- Al seguir se emite la notificación `new_follower` con `notify()` (stub hasta W2-3; dedupe `new_follower:<follower>:<following>`).
- **Privacidad:** el perfil ajeno muestra datos públicos dentro de la app (para usuarios logueados): nombre, foto, bio, conteos, insignias, grupos en común y las últimas 10 actividades (tipo, fecha y duración; las notas **no**). **Nunca** muestra el email.
- La búsqueda de usuarios es por nombre, con prefijo y sin acentos, con un máximo de 20 resultados y un mínimo de 2 caracteres en la query.

**UI:**
- `/u/[id]` tiene un header con avatar grande, nombre y bio.
- Debajo, los contadores "N seguidores · N seguidos · N entrenamientos", que linkean a las listas.
- El `FollowButton` dice "Seguir", "Siguiendo ✓" o "Amigos ✓" según el estado, con `pending` y actualización optimista vía `useOptimistic`.
- Después vienen la grilla de insignias (`BadgeGrid` de W1-2), los grupos en común y la actividad reciente.
- En toda la app, los avatares y nombres de otros usuarios linkean a `/u/[id]`: listas de miembros y actividades del grupo. Ese cableado lo hacen W2-2 y W2-4 con `<Avatar href>`. Acá se deja documentado en el `ProfileView`.

- [ ] **Step 1:** tests de integración:
  - seguir y dejar de seguir;
  - la idempotencia;
  - que seguirse a sí mismo da error;
  - `isFriend` con seguimiento mutuo;
  - que `getPublicProfile` no expone el email ni las notas.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** verificar con 2 usuarios: seguir desde `/u/[id]`, ver que el contador sube y que, cuando el otro te sigue, aparece "Amigos ✓".
- [ ] **Step 4: Commit**

```bash
git add src/server/social src/server/actions/social.ts src/features/profile src/features/social app/u
git commit -m "feat(social): follow users, friends and public profiles"
```

---

### Task 4: Seguridad y gestión de grupos

**Files:**
- Create: `src/server/groups/membership.ts`
- Create: `src/server/groups/invite.ts`
- Create: `src/server/groups/queries.ts` (DTO de grupo **sin** `inviteCode` ni emails)
- Create: `src/server/actions/groups.ts`
- Delete: `app/api/groups/**` (después de migrar sus consumidores, sin rediseño: el cableado mínimo en `GroupPageClient`, `JoinGroupModal`, `GroupInviteCodePanel`, `EditGroupForm`, `LeaveGroupButton`, `DeleteGroupButton` y `create-group`)
- Test: `src/server/groups/*.test.ts` + `src/server/actions/groups.int.test.ts`

**Interfaces:**
- Produce (las consume W2-2):

```ts
export async function createGroupAction(input: { name: string; description?: string | null; photoUrl?: string | null; timezone?: string }): Promise<ActionResult<{ groupId: string }>>;
export async function updateGroupAction(groupId: string, input: { name: string; description?: string | null; photoUrl?: string | null; timezone: string }): Promise<ActionResult<void>>;
export async function deleteGroupAction(groupId: string): Promise<ActionResult<void>>;
export async function getInviteCodeAction(groupId: string): Promise<ActionResult<{ code: string; expiresAt: Date }>>;      // solo admin
export async function regenerateInviteCodeAction(groupId: string): Promise<ActionResult<{ code: string; expiresAt: Date }>>;
export async function joinGroupAction(code: string): Promise<ActionResult<{ groupId: string }>>;
export async function leaveGroupAction(groupId: string): Promise<ActionResult<void>>;
export async function kickMemberAction(groupId: string, userId: string): Promise<ActionResult<void>>;
export async function setMemberRoleAction(groupId: string, userId: string, role: "admin" | "member"): Promise<ActionResult<void>>;
export async function getGroupForMember(groupId: string, userId: string): Promise<GroupDTO>; // { id, name, description, photoUrl, timezone, myRole, members: { userId, name, photoUrl, role, joinedAt }[] }
```

Reglas, cada una con test:
- **Códigos de invitación:** 8 caracteres de un alfabeto sin ambigüedades (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), generados con `crypto.randomInt`. Vencen a los 7 días. La comparación no distingue mayúsculas.
- **Unirse:** máximo 10 intentos por usuario cada 15 min. Si alguien vuelve a entrar a un grupo, **siempre queda como `member`**: corrige el bug del admin que reingresaba como admin. Si el grupo tiene una temporada activa, el usuario **no** queda unido automáticamente: lo decide desde la UI con `joinSeasonAction`. Se emite la notificación `member_joined` a los admins.
- **Salir:** el último admin no puede salir si quedan otros miembros. El mensaje es "Nombrá a otro admin antes de salir" y la UI ofrece `setMemberRoleAction`. Si es el único miembro, al salir se borra el grupo, previa confirmación.
- **Expulsar:** solo un admin puede expulsar, y no a sí mismo. La expulsión marca `leftAt` y `status = removed` y saca al usuario de las temporadas activas, con `recomputeSeason` de cada una.
- **`getGroupForMember`:** nunca devuelve `inviteCode` ni los emails de los miembros.
- **Crear grupo:** guarda la `description`, que antes se descartaba. El creador queda como admin.

- [ ] **Step 1:** tests (unitarios de `invite.ts` y de integración de las acciones).
- [ ] **Step 2:** implementar y cablear los componentes existentes con `<Button pending>` + `toastResult`. Reemplazar `confirm()` por `useConfirm()` en salir, borrar y expulsar. Después de crear, editar o borrar, navegar a `/group/<id>` o a `/home` (corrige que antes iba al último grupo).
- [ ] **Step 3:** verificar el flujo completo con 2 usuarios:
  - invitar y unirse con el código en minúsculas;
  - promover a admin;
  - que el admin original salga;
  - expulsar a un miembro y verificar que deja de aparecer en el ranking.
- [ ] **Step 4: Commit**

```bash
git add -A src/server/groups src/server/actions/groups.ts app/api/groups app/group app/create-group src/components
git commit -m "feat(groups): secure invites, roles, kick and leave rules"
```

---

### Task 5: Reacciones, feed de amigos e invitar amigos a grupos

**Files:**
- Create: `src/server/social/reactions.ts`
- Create: `src/server/social/feed.ts`
- Modify: `src/server/actions/social.ts` (nuevas acciones)
- Modify: `src/server/actions/groups.ts` (`inviteFriendsToGroupAction`)
- Create: `src/features/social/ReactionBar.tsx`
- Create: `src/features/social/FriendActivityCard.tsx` (tarjeta de feed: avatar, nombre, actividad, duración, foto `thumbUrl`, puntos si comparten temporada y `ReactionBar`)
- Create: `src/features/social/InviteFriendsSheet.tsx`
- Test: `src/server/social/reactions.int.test.ts`, `src/server/social/feed.int.test.ts`

**Interfaces:**
- Produce (las consumen W2-1, W2-2, W2-3 y W2-4):

```ts
export const REACTION_EMOJIS = ["💪", "🔥", "👏", "😂", "🫡"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export type ReactionSummary = { emoji: ReactionEmoji; count: number; mine: boolean; users: { id: string; name: string | null }[] }[];
export async function toggleReactionAction(activityId: string, emoji: ReactionEmoji): Promise<ActionResult<{ summary: ReactionSummary }>>;
export async function getReactionSummaries(activityIds: string[], viewerId: string): Promise<Map<string, ReactionSummary>>;
export type FeedItem = { activityId: string; user: { id: string; name: string | null; photoUrl: string | null }; categoryName: string; startedAt: Date; durationMinutes: number; thumbUrl: string | null; photoUrl: string | null; reactions: ReactionSummary };
export async function getFriendsFeed(viewerId: string, opts: { cursor?: string; limit?: number }): Promise<{ items: FeedItem[]; nextCursor: string | null }>;
export async function getFriendsLatestWithPhoto(viewerId: string, limit: number): Promise<FeedItem[]>; // para el widget (W4)
export async function inviteFriendsToGroupAction(groupId: string, userIds: string[]): Promise<ActionResult<{ invited: number }>>;
export async function listFriendsAction(): Promise<ActionResult<{ id: string; name: string | null; photoUrl: string | null }[]>>;
```

**Reglas** (cada una con su test):
- **Quién puede reaccionar:** el viewer puede ver la actividad si es suya, si sigue al dueño o si comparten un grupo. Si no, responde `FORBIDDEN`.
- **`toggleReactionAction`:** si la reacción ya existe la borra, y si no la crea. Solo se aceptan emojis de `REACTION_EMOJIS`.
- **Notificación:** al crear una reacción se llama a `notify` con `type: "reaction_received"`, el dueño como destinatario, `actorId`, `activityId`, `data: { emoji }` y dedupeKey `reaction:<activityId>:<actorId>:<emoji>:<recipientId>`. No se notifica si el que reacciona es el dueño.
- **Feed de amigos:**
  - Muestra actividades de la gente que el viewer **sigue**, más las propias.
  - Va en orden descendente por `startedAt` y pagina con cursor (`startedAt|id`).
  - **No** expone las notas.
  - Cada item trae las reacciones resumidas con una query agrupada, sin N+1.
- **Invitar amigos a un grupo:**
  - Solo puede invitar un admin, y solo a amigos (seguimiento mutuo).
  - La invitación se entrega como notificación `member_joined` con `data: { kind: "invite", groupId, inviterId }`. Se renderiza como "<inviter> te invitó a <grupo>" y tiene un `href` a `/groups/join?token=<token>`. Así no hace falta un tipo nuevo en el schema.
  - El token es un JWT corto (7 días) firmado con `JWT_SECRET`, con `{ groupId, userId }`. Lo acepta `joinGroupByInviteTokenAction(token)` (agregarla también), que solo funciona para ese usuario.

**UI:**
- **`ReactionBar`:**
  - Muestra chips con emoji y conteo. Los que ya puso el viewer se ven resaltados con `bg-surface-3` y `ring-primary`.
  - Un botón "+" abre el selector de los 5 emojis.
  - Al tocar, la actualización es **optimista** (`useOptimistic`) y, si falla, se revierte con `toast.error`.
  - Con un long-press sobre un chip se ve quiénes reaccionaron.
- **`InviteFriendsSheet`:** lista de amigos con checkbox, buscador y el botón "Invitar (N)". Los que ya son miembros aparecen deshabilitados con el texto "Ya está en el grupo".

- [ ] **Step 1:** tests de integración:
  - toggle de reacción (crear/quitar) y permisos (un desconocido recibe `FORBIDDEN`);
  - que el resumen agrupa bien;
  - que el feed solo muestra seguidos y propios, pagina sin duplicados y no expone notas;
  - invitar a alguien que no es amigo da error, y el token solo sirve para su destinatario.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** sección en `/dev/ui` (`app/dev/ui/sections/social.tsx`) con `ReactionBar` y `FriendActivityCard` usando datos de ejemplo.
- [ ] **Step 4: Commit**

```bash
git add src/server/social src/server/actions/social.ts src/server/actions/groups.ts src/features/social app/dev/ui/sections
git commit -m "feat(social): reactions, friends feed and invite friends to groups"
```

---

### Verificación final de W1-4
- [ ] `grep -rn "fetch(\"/api/auth\|fetch(\"/api/groups\|fetch(\"/api/profile" app src` devuelve vacío.
- [ ] El DTO de grupo no lleva `inviteCode` ni emails: verificarlo con el JSON del RSC en DevTools → Network.
- [ ] Gates verdes. Pedir review y merge.
