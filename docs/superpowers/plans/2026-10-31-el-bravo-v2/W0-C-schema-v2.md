# W0-C — Schema v2, migración de datos y servicio de actividades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 Decisiones D1–D7, §4, §5.4–5.6 y 5.10, §6.2).

**Goal:** dejar en una sola migración **todo** el modelo de datos de v2, migrar los datos existentes sin pérdida y construir el único camino de escritura de actividades (crear/editar/borrar), que dispara los recálculos. Las olas siguientes no tocan el schema.

**Architecture:** primero se crea la migración `v2_core` con el schema nuevo, después la migración de datos (SQL dentro de la misma migración más un script TypeScript idempotente para lo que no se puede hacer en SQL) y por último el servicio `src/server/activities`, que valida con Zod, escribe en una transacción y, **después del commit**, llama a `runActivityEffects`. `runActivityEffects` a su vez llama a stubs con la firma final de puntos, insignias y notificaciones.

**Tech Stack:** Prisma 7 migrate, MySQL 8.4, Zod 4, Vitest (integración contra `elbravo_<id>_test`).

**Spec:** `docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md`

**Depende de:** W0-A mergeado (Vitest, `src/lib/time`, DAL). **Rama:** `v2/w0-c-schema`. Puerto: 3003. Preparar la DB con `npm run db:worktree -- w0-c 3003`.

## Global Constraints
Ver `00-roadmap.md` §4. Este es el **único** workstream que crea migraciones hasta el fin de la Ola 2.

---

### Task 1: Schema v2 (una migración)

**Files:**
- Modify: `prisma/schema.prisma` (reemplazo completo, abajo)
- Create: `prisma/migrations/<timestamp>_v2_core/migration.sql` (generada, después editada a mano para la migración de datos; ver Task 2)

**Interfaces:**
- Produce: el modelo de datos de v2, que todos los workstreams consumen. Los nombres de modelos y campos son contrato.

- [ ] **Step 1: Reemplazar `prisma/schema.prisma` por:**

```prisma
datasource db {
  provider = "mysql"
}

generator client {
  provider = "prisma-client-js"
}

////////////////////
// ENUMS
////////////////////

enum GroupRole {
  admin
  member
}

enum MembershipStatus {
  pending
  accepted
  rejected
  removed
}

enum ExerciseMeasureType {
  reps
  duration
}

enum Equipment {
  barbell
  dumbbell
  machine
  cable
  bodyweight
  kettlebell
  band
  cardio
  other
}

enum SetKind {
  warmup
  normal
  drop
  failure
}

enum ResultsReveal {
  auto
  manual
}

enum ScoreKind {
  workout
  weekly_goal
  streak
  award
  adjustment
}

enum MediaStatus {
  pending
  ready
}

enum DevicePlatform {
  web
  android
  ios
}

enum NotificationType {
  first_workout_of_week
  weekly_goal_met
  streak_milestone
  badge_level_up
  rank_overtaken
  season_started
  season_results_published
  new_follower
  member_joined
  weekly_digest // registro técnico de envío del resumen semanal; no se muestra en el feed
  friend_workout
  reaction_received
}

////////////////////
// USUARIOS Y SOCIAL
////////////////////

model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  name         String? @db.VarChar(80)
  photoUrl     String? @db.VarChar(2048)
  bio          String? @db.VarChar(280)

  weeklyGoal   Int     @default(3)
  timezone     String  @default("America/Argentina/Buenos_Aires") @db.VarChar(64)
  tokenVersion Int     @default(0)

  emailVerifiedAt DateTime?
  isActive        Boolean   @default(true)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  groupMembers       GroupMember[]
  seasonMembers      SeasonMember[]
  activities         Activity[]
  routines           Routine[]
  scoreEntries       ScoreEntry[]
  standings          SeasonStanding[]
  badges             UserBadge[]
  awardsWon          SeasonAwardWinner[]
  following          Follow[]                 @relation("Following")
  followers          Follow[]                 @relation("Followers")
  notifications      Notification[]           @relation("NotifRecipient")
  notificationsActed Notification[]           @relation("NotifActor")
  notificationPrefs  NotificationPreference[]
  passwordResets     PasswordResetToken[]
  createdExercises   Exercise[]
  reactions          Reaction[]
  devices            Device[]
}

// Dispositivos para push (web o nativo) y para el widget nativo (D12)
model Device {
  id               String         @id @default(cuid())
  userId           String
  platform         DevicePlatform
  pushEndpointHash String?        @unique @db.VarChar(64)  // sha256 del endpoint Web Push (para dedupe)
  pushSubscription Json?          // { endpoint, keys: { p256dh, auth } } de Web Push
  fcmToken         String?        @unique @db.VarChar(255) // push nativo (Android/iOS vía Firebase)
  widgetTokenHash  String?        @unique @db.VarChar(64)  // sha256 del token que usa el widget nativo
  label            String?        @db.VarChar(80)          // "Pixel 8 de Manu"
  lastSeenAt       DateTime       @default(now())
  createdAt        DateTime       @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())

  follower  User @relation("Following", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followingId])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique @db.VarChar(128)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

////////////////////
// GRUPOS Y TEMPORADAS
////////////////////

model Group {
  id          String  @id @default(cuid())
  name        String  @db.VarChar(80)
  description String? @db.Text
  photoUrl    String? @db.VarChar(2048)
  timezone    String  @default("America/Argentina/Buenos_Aires") @db.VarChar(64)

  createdBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  inviteCode          String?   @unique @db.VarChar(12)
  inviteCodeExpiresAt DateTime?

  members       GroupMember[]
  seasons       Season[]
  notifications Notification[]

  @@index([createdBy])
}

model GroupMember {
  id      String @id @default(cuid())
  groupId String
  userId  String

  role   GroupRole
  status MembershipStatus @default(accepted)

  requestedAt DateTime?
  acceptedAt  DateTime?
  respondedAt DateTime?
  respondedBy String?

  joinedAt DateTime  @default(now())
  leftAt   DateTime?

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([userId])
  @@index([groupId, status])
}

model Season {
  id          String  @id @default(cuid())
  groupId     String
  name        String  @db.VarChar(80)
  description String? @db.Text

  startDate DateTime @db.Date // fecha local (zona del grupo), inclusiva
  endDate   DateTime @db.Date // fecha local (zona del grupo), inclusiva

  // Reglas (D1). Defaults = reglas estándar.
  weeklyGoal       Int @default(3)   // días entrenados por semana
  minDailyMinutes  Int @default(20)  // minutos efectivos mínimos para que un día cuente
  dayBasePoints    Int @default(10)  // puntos por presentarte
  timePointsFactor Int @default(10)  // factor de la curva de tiempo
  timeCurveMinutes Int @default(30)  // escala de la curva: 10 × log2(1 + min/30)
  maxDailyMinutes  Int @default(240) // tope de minutos por día
  weeklyGoalBonus  Int @default(20)
  streakBonusStep  Int @default(5)
  streakBonusCap   Int @default(25)

  // Ciclo de vida (D3)
  resultsReveal      ResultsReveal @default(auto)
  finalizedAt        DateTime?
  resultsPublishedAt DateTime?
  lastComputedAt     DateTime?

  createdBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  group        Group            @relation(fields: [groupId], references: [id], onDelete: Cascade)
  members      SeasonMember[]
  categories   SeasonCategory[]
  awards       SeasonAward[]
  scoreEntries ScoreEntry[]
  standings    SeasonStanding[]
  notifications Notification[]

  @@index([groupId])
  @@index([startDate, endDate])
}

model SeasonMember {
  id       String    @id @default(cuid())
  seasonId String
  userId   String
  joinedAt DateTime  @default(now())
  leftAt   DateTime?

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([seasonId, userId])
  @@index([userId])
}

model SeasonCategory {
  id                 String  @id @default(cuid())
  seasonId           String
  activityCategoryId String
  weight             Decimal @default(1.00) @db.Decimal(3, 2) // slider 0..2, pasos de 0.25

  season           Season           @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  activityCategory ActivityCategory @relation(fields: [activityCategoryId], references: [id], onDelete: Cascade)

  @@unique([seasonId, activityCategoryId])
  @@index([activityCategoryId])
}

model SeasonAward {
  id          String  @id @default(cuid())
  seasonId    String
  awardType   String  @db.VarChar(48) // catálogo en src/server/scoring/awards.ts
  bonusPoints Int     @default(0)

  season  Season              @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  winners SeasonAwardWinner[]

  @@unique([seasonId, awardType])
}

model SeasonAwardWinner {
  id            String @id @default(cuid())
  seasonAwardId String
  userId        String
  value         Float  // valor que lo hizo ganar (ej. 14 entrenamientos)

  seasonAward SeasonAward @relation(fields: [seasonAwardId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([seasonAwardId, userId])
  @@index([userId])
}

model ScoreEntry {
  id         String    @id @default(cuid())
  seasonId   String
  userId     String
  activityId String?
  kind       ScoreKind
  weekKey    String?   @db.Char(10)
  points     Int
  reason     String?   @db.VarChar(160) // motivo legible ("Ya sumaste un entrenamiento hoy")
  detail     Json?

  season   Season    @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  activity Activity? @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([seasonId, userId])
  @@index([activityId])
}

model SeasonStanding {
  id            String @id @default(cuid())
  seasonId      String
  userId        String
  rank          Int
  points        Int
  daysTrained   Int
  activities    Int
  minutes       Int
  weeksGoalMet  Int
  currentStreak Int
  bestStreak    Int

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([seasonId, userId])
  @@index([seasonId, rank])
}

////////////////////
// EJERCICIOS Y RUTINAS
////////////////////

model Exercise {
  id           String              @id @default(cuid())
  slug         String              @unique @db.VarChar(80)
  name         String              @unique @db.VarChar(100)
  nameEn       String?             @db.VarChar(100)
  description  String?             @db.Text
  instructions Json? // string[] de pasos (es-AR)
  mediaUrl     String?             @db.VarChar(2048)
  equipment    Equipment           @default(other)
  measureType  ExerciseMeasureType @default(reps)
  tracksWeight Boolean             @default(true)
  createdByUserId String? // null = catálogo oficial

  createdBy  User?              @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
  aliases    ExerciseAlias[]
  muscles    ExerciseMuscle[]
  routines   RoutineExercise[]
  activities ActivityExercise[]

  @@index([createdByUserId])
}

model ExerciseAlias {
  id         String @id @default(cuid())
  exerciseId String
  alias      String @db.VarChar(100) // minúsculas, sin acentos
  locale     String @default("es") @db.VarChar(8)

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@unique([exerciseId, alias])
  @@index([alias])
}

model Muscle {
  id       String @id @default(cuid())
  name     String @unique
  slug     String @unique
  groupKey String @db.VarChar(64)

  exercises ExerciseMuscle[]
}

model ExerciseMuscle {
  exerciseId String
  muscleId   String
  percentage Int

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  muscle   Muscle   @relation(fields: [muscleId], references: [id], onDelete: Cascade)

  @@id([exerciseId, muscleId])
  @@index([muscleId])
}

model Routine {
  id     String  @id @default(cuid())
  name   String  @db.VarChar(100)
  notes  String? @db.Text
  userId String

  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  activities Activity[]
  exercises  RoutineExercise[]

  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  @@index([userId])
}

model RoutineExercise {
  id          String  @id @default(cuid())
  routineId   String
  exerciseId  String
  position    Int
  restSeconds Int?
  notes       String? @db.Text

  routine  Routine      @relation(fields: [routineId], references: [id], onDelete: Cascade)
  exercise Exercise     @relation(fields: [exerciseId], references: [id], onDelete: Restrict)
  sets     RoutineSet[]

  @@unique([routineId, position])
  @@index([exerciseId])
}

model RoutineSet {
  id                    String  @id @default(cuid())
  routineExerciseId     String
  position              Int
  kind                  SetKind @default(normal)
  targetReps            Int?
  targetDurationSeconds Int?
  targetWeightKg        Float?
  restSeconds           Int?

  routineExercise RoutineExercise @relation(fields: [routineExerciseId], references: [id], onDelete: Cascade)

  @@unique([routineExerciseId, position])
}

////////////////////
// ACTIVIDADES
////////////////////

model ActivityCategory {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  usesExercises Boolean @default(false) // true en fuerza/calistenia/crossfit/hiit: el form muestra ejercicios
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  activities Activity[]
  seasons    SeasonCategory[]

  @@index([isActive, sortOrder])
}

model Activity {
  id                 String   @id @default(cuid())
  userId             String
  activityCategoryId String
  routineId          String?
  startedAt          DateTime // instante UTC
  durationMinutes    Int
  notes              String?  @db.Text
  clientRequestId    String?  @unique @db.VarChar(64) // idempotencia de envíos/reintentos

  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  activityCategory ActivityCategory   @relation(fields: [activityCategoryId], references: [id], onDelete: Restrict)
  routine          Routine?           @relation(fields: [routineId], references: [id], onDelete: SetNull)
  exercises        ActivityExercise[]
  media            ActivityMedia[]
  scoreEntries     ScoreEntry[]
  notifications    Notification[]
  reactions        Reaction[]

  @@index([userId, startedAt])
  @@index([startedAt])
  @@index([activityCategoryId])
  @@index([routineId])
}

// Reacciones a entrenamientos (D5). Set fijo de emojis validado en código.
model Reaction {
  id         String   @id @default(cuid())
  activityId String
  userId     String
  emoji      String   @db.VarChar(16)
  createdAt  DateTime @default(now())

  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([activityId, userId, emoji])
  @@index([activityId])
}

model ActivityExercise {
  id         String  @id @default(cuid())
  activityId String
  exerciseId String
  position   Int
  notes      String? @db.Text

  activity Activity      @relation(fields: [activityId], references: [id], onDelete: Cascade)
  exercise Exercise      @relation(fields: [exerciseId], references: [id], onDelete: Restrict)
  sets     ActivitySet[]

  @@unique([activityId, position])
  @@index([exerciseId])
}

model ActivitySet {
  id                 String    @id @default(cuid())
  activityExerciseId String
  position           Int
  kind               SetKind   @default(normal)
  reps               Int?
  durationSeconds    Int?
  weightKg           Float?
  restSeconds        Int?
  completed          Boolean   @default(true)
  completedAt        DateTime?

  activityExercise ActivityExercise @relation(fields: [activityExerciseId], references: [id], onDelete: Cascade)

  @@unique([activityExerciseId, position])
}

model ActivityMedia {
  id         String      @id @default(cuid())
  activityId String
  url        String      @db.VarChar(2048)
  storageKey String?     @db.VarChar(255)
  mimeType   String?     @db.VarChar(128)
  sizeBytes  Int?
  width      Int?
  height     Int?
  position   Int         @default(0)
  thumbUrl   String?     @db.VarChar(2048) // miniatura 400 px (feeds, widget, push)
  status     MediaStatus @default(ready)
  uploadedAt DateTime    @default(now())

  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([activityId])
}

////////////////////
// INSIGNIAS (D2)
////////////////////

model Badge {
  id          String  @id @default(cuid())
  code        String  @unique @db.VarChar(64)
  name        String  @db.VarChar(80)
  description String  @db.Text
  metric      String  @db.VarChar(48) // ver src/server/badges/metrics.ts
  params      Json?
  iconKey     String? @db.VarChar(64)
  sortOrder   Int     @default(0)
  isActive    Boolean @default(true)

  levels BadgeLevel[]
  users  UserBadge[]
}

model BadgeLevel {
  id        String @id @default(cuid())
  badgeId   String
  level     Int
  threshold Int

  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([badgeId, level])
}

model UserBadge {
  userId     String
  badgeId    String
  level      Int       @default(0)
  progress   Int       @default(0)
  achievedAt DateTime? // cuándo alcanzó el nivel actual
  updatedAt  DateTime  @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@id([userId, badgeId])
}

////////////////////
// NOTIFICACIONES
////////////////////

model Notification {
  id          String           @id @default(cuid())
  recipientId String
  actorId     String?
  type        NotificationType
  groupId     String?
  seasonId    String?
  activityId  String?
  data        Json?
  dedupeKey   String           @unique @db.VarChar(191)
  readAt      DateTime?
  emailedAt   DateTime?
  pushedAt    DateTime?
  createdAt   DateTime         @default(now())

  recipient User      @relation("NotifRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User?     @relation("NotifActor", fields: [actorId], references: [id], onDelete: SetNull)
  group     Group?    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  season    Season?   @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  activity  Activity? @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([recipientId, readAt, createdAt])
}

model NotificationPreference {
  userId String
  type   NotificationType
  inApp  Boolean          @default(true)
  email  Boolean          @default(false)
  push   Boolean          @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, type])
}
```

- [ ] **Step 2: Generar la migración SIN aplicarla**

Run: `npx prisma migrate dev --name v2_core --create-only`
Expected: se crea `prisma/migrations/<ts>_v2_core/migration.sql`. Prisma va a avisar que se pierden datos (columnas eliminadas). Es esperado: en la Task 2 se reordena el SQL para copiar los datos antes de borrar.

- [ ] **Step 3: Commit (solo el schema + el SQL generado, sin editar todavía)**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): v2 core schema (generated migration, data steps pending)"
```

---

### Task 2: Migración de datos (sin pérdida)

**Files:**
- Modify: `prisma/migrations/<ts>_v2_core/migration.sql`
- Create: `scripts/migrate-v2-data.ts`
- Create: `scripts/fixtures/v1-sample.sql` (dump chico de v1 para probar)
- Test: `scripts/migrate-v2-data.int.test.ts`

**Interfaces:**
- Produce: `npx tsx scripts/migrate-v2-data.ts`, idempotente. Completa lo que el SQL no puede (slugs, posiciones) y al final recalcula **todas** las temporadas y las insignias. Como el recálculo es de W1-1/W1-2, en esta ola llama a los stubs; W3 lo vuelve a correr cuando los motores existen.

El orden obligatorio dentro de `migration.sql` es **agregar → copiar → borrar**. Usar siempre los nombres de tabla exactos de Prisma (`Activity`, `SeasonCategory`…): funcionan tanto con `lower_case_table_names=1` (local) como con `0` (MySQL en Linux, que distingue mayúsculas). Hay que editar el archivo generado moviendo los `DROP COLUMN`/`DROP TABLE` al final e insertando estos pasos de copia antes:

- [ ] **Step 1: Copias en SQL (insertar antes de los DROP)**

```sql
-- Actividades: categoría obligatoria. Si falta, se mapea el tipo legacy a una categoría.
UPDATE `Activity` a
LEFT JOIN `ActivityCategory` c ON c.slug = CASE a.`type`
  WHEN 'gym' THEN 'strength' WHEN 'run' THEN 'running' WHEN 'mobility' THEN 'yoga_pilates'
  WHEN 'sport' THEN 'hiit_functional' ELSE 'strength' END
SET a.`activityCategoryId` = COALESCE(a.`activityCategoryId`, c.id)
WHERE a.`activityCategoryId` IS NULL;

-- durationMinutes obligatorio: derivar de endedAt si falta.
UPDATE `Activity` SET `durationMinutes` = GREATEST(1, TIMESTAMPDIFF(MINUTE, `startedAt`, `endedAt`))
WHERE `durationMinutes` IS NULL OR `durationMinutes` <= 0;

-- Borrado duro (D7): eliminar lo que estaba marcado como borrado (los hijos caen por cascade/FK).
DELETE FROM `Activity` WHERE `isDeleted` = 1;

-- Series: una fila ActivitySet por cada "set" del formato viejo.
-- (Requiere que la migración ya haya creado ActivitySet y agregado ActivityExercise.position.)
INSERT INTO `ActivitySet` (`id`, `activityExerciseId`, `position`, `kind`, `reps`, `durationSeconds`, `weightKg`, `completed`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(ae.id, '-', n.n)), 1, 22)), ae.id, n.n, 'normal', ae.reps, ae.durationSeconds, ae.weightKg, 1
FROM `ActivityExercise` ae
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
      UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
      UNION ALL SELECT 18 UNION ALL SELECT 19) n ON n.n < LEAST(GREATEST(ae.sets, 1), 20);

-- Igual para rutinas.
INSERT INTO `RoutineSet` (`id`, `routineExerciseId`, `position`, `kind`, `targetReps`, `targetDurationSeconds`, `targetWeightKg`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(re.id, '-', n.n)), 1, 22)), re.id, n.n, 'normal', re.reps, re.durationSeconds, re.weightKg
FROM `RoutineExercise` re
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
      UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
      UNION ALL SELECT 18 UNION ALL SELECT 19) n ON n.n < LEAST(GREATEST(re.sets, 1), 20);

-- Categorías habilitadas por temporada: SeasonAllowedActivityType → SeasonCategory (peso 1).
INSERT INTO `SeasonCategory` (`id`, `seasonId`, `activityCategoryId`, `weight`)
SELECT s.id, s.seasonId, s.activityCategoryId, 1.00 FROM `SeasonAllowedActivityType` s;

-- Temporadas sin categorías: habilitar todas (comportamiento v1 = todo cuenta).
INSERT INTO `SeasonCategory` (`id`, `seasonId`, `activityCategoryId`, `weight`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(se.id, '-', c.id)), 1, 22)), se.id, c.id, 1.00
FROM `Season` se CROSS JOIN `ActivityCategory` c
WHERE NOT EXISTS (SELECT 1 FROM `SeasonCategory` sc WHERE sc.seasonId = se.id);

-- Temporadas finalizadas en v1 → finalizedAt; publicadas.
UPDATE `Season` SET `finalizedAt` = `endedAt`, `resultsPublishedAt` = `endedAt` WHERE `endedAt` IS NOT NULL;

-- Usuarios sin timezone → default.
UPDATE `User` SET `timezone` = 'America/Argentina/Buenos_Aires' WHERE `timezone` IS NULL OR `timezone` = '';
```

Notas:
- **Antes de estas copias**, el SQL generado tiene que agregar las columnas nuevas como **NULL-ables o con default**: `ActivityExercise.position`, `RoutineExercise.position` y `Exercise.slug`. Si Prisma las generó `NOT NULL` sin default, partir el paso: `ADD COLUMN ... NULL`, completarlas (Step 2) y recién después `MODIFY ... NOT NULL`.
- Para las posiciones se usa SQL con variables de MySQL 8 y `ROW_NUMBER()`:

```sql
UPDATE `ActivityExercise` ae JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY activityId ORDER BY id) - 1 AS pos FROM `ActivityExercise`
) x ON x.id = ae.id SET ae.position = x.pos;
UPDATE `RoutineExercise` re JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY routineId ORDER BY id) - 1 AS pos FROM `RoutineExercise`
) x ON x.id = re.id SET re.position = x.pos;
```

- **Season `startDate`/`endDate`** pasan de `DATETIME(3)` (mediodía UTC) a `DATE`. `MODIFY COLUMN ... DATE` conserva la fecha, porque mediodía UTC cae en el mismo día. Verificarlo en el test.
- **Las tablas viejas que se eliminan** (`ScoreEvent`, `SeasonWeekProgress`, `ActivitySeason`, `AwardDefinition`, `AwardEarned`, `SeasonAllowedActivityType`) se borran **al final**. Los puntos y las insignias se recalculan, no se migran.

- [ ] **Step 2: `scripts/migrate-v2-data.ts` (lo que el SQL no hace)**

```ts
import { prisma } from "@/src/lib/db";
import { recomputeSeason } from "@/src/server/scoring";
import { recomputeUserBadges } from "@/src/server/badges";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  // 1) slugs de ejercicios (únicos)
  const exercises = await prisma.exercise.findMany({ select: { id: true, name: true, slug: true } });
  const used = new Set(exercises.map((e) => e.slug).filter(Boolean));
  for (const e of exercises) {
    if (e.slug && !e.slug.startsWith("tmp-")) continue;
    let s = slugify(e.name), i = 2;
    while (used.has(s)) s = `${slugify(e.name)}-${i++}`;
    used.add(s);
    await prisma.exercise.update({ where: { id: e.id }, data: { slug: s } });
  }
  // 2) recálculo total
  for (const { id } of await prisma.season.findMany({ select: { id: true } })) await recomputeSeason(id);
  for (const { id } of await prisma.user.findMany({ select: { id: true } })) await recomputeUserBadges(id);
  console.log("migrate-v2-data OK");
}

main().finally(() => prisma.$disconnect());
```

Si `slug` es `NOT NULL @unique`, la migración SQL tiene que completarlo primero con un valor temporal único, `CONCAT('tmp-', id)`. El script lo reemplaza después (por eso chequea `startsWith("tmp-")`).

- [ ] **Step 3: Test de integración de la migración**

`scripts/fixtures/v1-sample.sql` contiene `INSERT`s de un escenario v1, escrito a mano contra el schema v1 (ver la migración `20261031050136_sync_schema_drift` y las anteriores):
- 2 usuarios, 1 grupo y 1 temporada (con `startDate` `2026-10-01 12:00:00` y 1 categoría habilitada);
- 3 actividades, una de ellas con `isDeleted=1`;
- 1 `ActivityExercise` con `sets=3, reps=10, weightKg=40`;
- 1 rutina con 1 ejercicio `sets=4`.

`scripts/migrate-v2-data.int.test.ts`:
1. Hace `DROP DATABASE`/`CREATE` de la DB de test.
2. Aplica todas las migraciones **hasta** `sync_schema_drift` (`prisma migrate resolve` no sirve; aplicar los `.sql` de v1 en orden con `mysql` vía `execSync`).
3. Carga el fixture.
4. Aplica la migración `v2_core` con `prisma migrate deploy`.
5. Corre el script.

Assert:

```ts
expect(await prisma.activity.count()).toBe(2);                           // la borrada no está
expect(await prisma.activitySet.count()).toBe(3);                         // 3 series de 10x40
expect((await prisma.activitySet.findFirst())?.weightKg).toBe(40);
expect(await prisma.routineSet.count()).toBe(4);
const s = await prisma.season.findFirstOrThrow();
expect(s.startDate.toISOString().slice(0, 10)).toBe("2026-10-01");
expect(await prisma.seasonCategory.count({ where: { seasonId: s.id } })).toBe(1);
expect((await prisma.exercise.findMany()).every((e) => !e.slug.startsWith("tmp-"))).toBe(true);
```

Run: `npm run test:int -- scripts/migrate-v2-data`
Expected: PASS.

> **Nota D13:** si la DB de producción ya no existe, esta migración de datos solo se usa con datos locales de desarrollo, y W3 arranca producción vacía. Igual se mantiene, porque es barata, deja probado el camino y sirve si aparecen datos en el servicio `el-bravo-prod` de Aiven.

- [ ] **Step 4: Aplicar en la DB del worktree y en la principal**

Run: `npx prisma migrate deploy && npx tsx scripts/migrate-v2-data.ts && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
Expected: el diff devuelve "-- This is an empty migration.".

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations scripts/migrate-v2-data.ts scripts/fixtures scripts/migrate-v2-data.int.test.ts
git commit -m "feat(db): lossless v1→v2 data migration"
```

---

### Task 3: Seed modular

**Files:**
- Delete: `prisma/seed.ts`
- Create: `prisma/seed/index.ts`, `prisma/seed/categories.ts`, `prisma/seed/muscles.ts`, `prisma/seed/exercises.ts`, `prisma/seed/badges.ts`
- Modify: `package.json` (`"seed": "tsx prisma/seed/index.ts"`)

**Interfaces:**
- Produce:
  - Funciones idempotentes (`upsert` por `slug`/`code`): `seedCategories()`, `seedMuscles()`, `seedExercises()` y `seedBadges()`.
  - **Propiedad posterior:** W1-3 es dueño de `exercises.ts` y de `prisma/seed/data/**`; W1-2 es dueño de `badges.ts`.

- [ ] **Step 1: Mover los datos actuales**
  - `categories.ts`: los 19 `activityTypes` del seed viejo, con `usesExercises: true` para `strength`, `calisthenics`, `crossfit` y `hiit_functional`.
  - `muscles.ts`: los 15 músculos.
  - `exercises.ts`: los 78 ejercicios + el mapeo muscular. Agregar `slug` (función `slugify` igual a la del script) y `equipment: "other"` por ahora (W1-3 lo completa).
  - `badges.ts`: por ahora exporta `seedBadges = async () => {}` con el comentario `// W1-2 completa las familias de insignias`.
- [ ] **Step 2: `index.ts`** llama en orden a categorías → músculos → ejercicios → insignias e imprime un resumen con conteos.
- [ ] **Step 3: Verificar**

Run: `npm run seed && npm run seed` (dos veces).
Expected: la segunda corrida no duplica nada; conteos 19 / 15 / 78.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed prisma/seed.ts package.json
git commit -m "refactor(db): modular idempotent seed"
```

---

### Task 4: Servicio de actividades + efectos (con stubs)

**Files:**
- Create: `src/schemas/workout.ts`
- Create: `src/server/activities/service.ts`
- Create: `src/server/activities/effects.ts`
- Create: `src/server/scoring/index.ts` (stub)
- Create: `src/server/badges/index.ts` (stub)
- Create: `src/server/notifications/index.ts` (stub)
- Test: `src/schemas/workout.test.ts`
- Test: `src/server/activities/service.int.test.ts`

**Interfaces:**
- Produce: el contrato §5.4 exacto. Stubs con las firmas de §5.5, §5.6 y §5.10:

```ts
// src/server/scoring/index.ts — STUB (W1-1 lo reemplaza; mantener los exports)
import type { ActivityChange } from "@/src/server/activities/effects";
export type { ScoringEffect } from "./types";
export async function recomputeSeason(_seasonId: string): Promise<void> {}
export async function recomputeSeasonsForChange(_c: ActivityChange): Promise<import("./types").ScoringEffect[]> { return []; }
export async function finalizeSeason(_seasonId: string, _o: { publish: boolean }): Promise<void> {}
```

`src/server/scoring/types.ts` contiene el tipo `ScoringEffect` de §5.5 tal cual. Del mismo modo:
- `src/server/badges/index.ts` exporta `BadgeChange`, `UserBadgeView`, `recomputeUserBadges` (devuelve `[]`) y `getUserBadges` (devuelve `[]`).
- `src/server/notifications/index.ts` exporta `emitActivityNotifications` (no-op) y `notify` (no-op).

- [ ] **Step 1: Tests del schema de Zod**

`src/schemas/workout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activityInputSchema } from "./workout";

const base = {
  clientRequestId: "req-1", activityCategoryId: "cat1", localDate: "2026-10-30", localTime: "18:00",
  durationMinutes: 70, exercises: [],
};

describe("activityInputSchema", () => {
  it("acepta una actividad sin ejercicios (running, yoga)", () => {
    expect(activityInputSchema.safeParse(base).success).toBe(true);
  });
  it("acepta series por repeticiones con peso y por tiempo", () => {
    const r = activityInputSchema.safeParse({ ...base, exercises: [
      { exerciseId: "e1", sets: [{ kind: "normal", reps: 10, weightKg: 40, completed: true }, { kind: "normal", reps: 8, weightKg: 45, completed: true }] },
      { exerciseId: "e2", sets: [{ kind: "normal", durationSeconds: 60, completed: true }] },
    ] });
    expect(r.success).toBe(true);
  });
  it("rechaza una serie sin reps ni tiempo, con mensaje en español", () => {
    const r = activityInputSchema.safeParse({ ...base, exercises: [{ exerciseId: "e1", sets: [{ kind: "normal", completed: true }] }] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Cada serie necesita repeticiones o tiempo");
  });
  it("rechaza duración fuera de rango y fecha mal formada", () => {
    expect(activityInputSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...base, durationMinutes: 1441 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...base, localDate: "30/10/2026" }).success).toBe(false);
  });
  it("coacciona strings numéricos y trata '' como null", () => {
    const r = activityInputSchema.parse({ ...base, durationMinutes: "45", exercises: [{ exerciseId: "e1", sets: [{ kind: "normal", reps: "10", weightKg: "", completed: true }] }] });
    expect(r.durationMinutes).toBe(45);
    expect(r.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: null });
  });
});
```

Run: `npx vitest run src/schemas`
Expected: FAIL.

- [ ] **Step 2: `src/schemas/workout.ts`**

```ts
import { z } from "zod";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optInt = (min: number, max: number) => z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable());
const optNum = (min: number, max: number) => z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

export const setKindSchema = z.enum(["warmup", "normal", "drop", "failure"]);

export const setInputSchema = z
  .object({
    kind: setKindSchema.default("normal"),
    reps: optInt(1, 1000).default(null),
    durationSeconds: optInt(1, 36000).default(null),
    weightKg: optNum(0, 1000).default(null),
    restSeconds: optInt(0, 3600).default(null),
    completed: z.boolean().default(true),
  })
  .refine((s) => s.reps !== null || s.durationSeconds !== null, { message: "Cada serie necesita repeticiones o tiempo", path: ["reps"] });

export const exerciseEntryInputSchema = z.object({
  exerciseId: z.string().min(1, "Elegí un ejercicio"),
  notes: z.string().trim().max(500).optional().nullable(),
  sets: z.array(setInputSchema).min(1, "Agregá al menos una serie").max(30),
});

export const activityInputSchema = z.object({
  clientRequestId: z.string().min(1).max(64),
  activityCategoryId: z.string().min(1, "Elegí el tipo de actividad"),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  localTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  durationMinutes: z.coerce.number().int().min(1, "La duración mínima es 1 minuto").max(1440, "Máximo 24 horas"),
  notes: z.string().trim().max(2000).optional().nullable(),
  routineId: z.string().optional().nullable(),
  exercises: z.array(exerciseEntryInputSchema).max(40).default([]),
});

export type SetInput = z.infer<typeof setInputSchema>;
export type ExerciseEntryInput = z.infer<typeof exerciseEntryInputSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
```

Run: `npx vitest run src/schemas`
Expected: PASS.

- [ ] **Step 3: `src/server/activities/effects.ts`**

```ts
import "server-only";
import { recomputeSeasonsForChange, type ScoringEffect } from "@/src/server/scoring";
import { recomputeUserBadges, type BadgeChange } from "@/src/server/badges";
import { emitActivityNotifications } from "@/src/server/notifications";

export type ActivitySnapshot = { id: string; userId: string; activityCategoryId: string; startedAt: Date; durationMinutes: number };
export type ActivityChange = { userId: string; before: ActivitySnapshot | null; after: ActivitySnapshot | null };
export type ActivityEffects = { scoring: ScoringEffect[]; badges: BadgeChange[] };

export async function runActivityEffects(change: ActivityChange): Promise<ActivityEffects> {
  const scoring = await recomputeSeasonsForChange(change);
  const badges = await recomputeUserBadges(change.userId);
  const effects = { scoring, badges };
  try {
    await emitActivityNotifications(change, effects);
  } catch (e) {
    console.error("[notifications]", e); // las notificaciones nunca rompen el guardado
  }
  return effects;
}
```

- [ ] **Step 4: Tests de integración del servicio**

`src/server/activities/service.int.test.ts`. Mockear los efectos para aislar el servicio:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("@/src/server/activities/effects", async (orig) => ({
  ...(await orig<typeof import("@/src/server/activities/effects")>()),
  runActivityEffects: vi.fn(async () => ({ scoring: [], badges: [] })),
}));

import { createActivity, updateActivity, deleteActivity, getActivityForEdit } from "./service";
import { runActivityEffects } from "./effects";

async function fixtures() {
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const other = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x", name: "B" } });
  const cat = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza", usesExercises: true } });
  const ex = await prisma.exercise.create({ data: { slug: "press-banca", name: "Press banca" } });
  return { user, other, cat, ex };
}

const input = (catId: string, exId: string) => ({
  clientRequestId: "req-1", activityCategoryId: catId, localDate: "2026-10-30", localTime: "18:00", durationMinutes: 70,
  exercises: [{ exerciseId: exId, sets: [{ kind: "normal" as const, reps: 10, weightKg: 40, durationSeconds: null, restSeconds: 90, completed: true }, { kind: "normal" as const, reps: 8, weightKg: 45, durationSeconds: null, restSeconds: null, completed: true }] }],
});

describe("activity service", () => {
  beforeEach(async () => { await resetDb(); vi.mocked(runActivityEffects).mockClear(); });

  it("crea con hora local → UTC, series en orden y dispara efectos", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { exercises: { include: { sets: { orderBy: { position: "asc" } } } } } });
    expect(a.startedAt.toISOString()).toBe("2026-10-30T21:00:00.000Z"); // timezone del usuario (AR)
    expect(a.exercises[0].sets.map((s) => s.weightKg)).toEqual([40, 45]);
    expect(runActivityEffects).toHaveBeenCalledWith({ userId: user.id, before: null, after: expect.objectContaining({ id: activityId }) });
  });

  it("es idempotente por clientRequestId (reintento no duplica)", async () => {
    const { user, cat, ex } = await fixtures();
    const a = await createActivity(user.id, input(cat.id, ex.id));
    const b = await createActivity(user.id, input(cat.id, ex.id));
    expect(b.activityId).toBe(a.activityId);
    expect(await prisma.activity.count()).toBe(1);
  });

  it("si un ejercicio no existe, no queda nada a medias", async () => {
    const { user, cat } = await fixtures();
    await expect(createActivity(user.id, input(cat.id, "no-existe"))).rejects.toThrow();
    expect(await prisma.activity.count()).toBe(0);
  });

  it("rechaza rutina ajena", async () => {
    const { user, other, cat, ex } = await fixtures();
    const r = await prisma.routine.create({ data: { name: "R", userId: other.id } });
    await expect(createActivity(user.id, { ...input(cat.id, ex.id), routineId: r.id })).rejects.toThrow("FORBIDDEN");
  });

  it("edita reemplazando ejercicios y pasa before/after a los efectos", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    await updateActivity(user.id, activityId, { ...input(cat.id, ex.id), clientRequestId: "req-2", localTime: "07:00", exercises: [] });
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { exercises: true } });
    expect(a.startedAt.toISOString()).toBe("2026-10-30T10:00:00.000Z");
    expect(a.exercises).toHaveLength(0);
    const call = vi.mocked(runActivityEffects).mock.calls.at(-1)![0];
    expect(call.before?.startedAt.toISOString()).toBe("2026-10-30T21:00:00.000Z");
    expect(call.after?.startedAt.toISOString()).toBe("2026-10-30T10:00:00.000Z");
  });

  it("solo el dueño edita/borra; borrar es duro", async () => {
    const { user, other, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    await expect(deleteActivity(other.id, activityId)).rejects.toThrow("NOT_FOUND");
    await deleteActivity(user.id, activityId);
    expect(await prisma.activity.count()).toBe(0);
    expect(await prisma.activitySet.count()).toBe(0);
  });

  it("getActivityForEdit devuelve fecha/hora local", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    const e = await getActivityForEdit(user.id, activityId);
    expect(e).toMatchObject({ localDate: "2026-10-30", localTime: "18:00", durationMinutes: 70 });
    expect(e.exercises[0].sets).toHaveLength(2);
  });
});
```

Run: `npm run test:int -- src/server/activities`
Expected: FAIL (no existe `service.ts`).

- [ ] **Step 5: `src/server/activities/service.ts`**

```ts
import "server-only";
import { prisma } from "@/src/lib/db";
import { zonedToUtc, localDateOf, localTimeOf } from "@/src/lib/time";
import { AuthError } from "@/src/server/auth/errors";
import { activityInputSchema, type ActivityInput } from "@/src/schemas/workout";
import { runActivityEffects, type ActivitySnapshot, type ActivityEffects } from "./effects";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
const snapshotSelect = { id: true, userId: true, activityCategoryId: true, startedAt: true, durationMinutes: true } as const;

async function userTz(userId: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } })).timezone;
}

async function assertRoutineOwner(tx: Tx, userId: string, routineId: string | null | undefined) {
  if (!routineId) return;
  const r = await tx.routine.findUnique({ where: { id: routineId }, select: { userId: true } });
  if (!r) throw new AuthError("NOT_FOUND");
  if (r.userId !== userId) throw new AuthError("FORBIDDEN");
}

async function writeExercises(tx: Tx, activityId: string, exercises: ActivityInput["exercises"]) {
  for (const [position, ex] of exercises.entries()) {
    await tx.activityExercise.create({
      data: {
        activityId, exerciseId: ex.exerciseId, position, notes: ex.notes ?? null,
        sets: { create: ex.sets.map((s, i) => ({ position: i, kind: s.kind, reps: s.reps, durationSeconds: s.durationSeconds, weightKg: s.weightKg, restSeconds: s.restSeconds, completed: s.completed })) },
      },
    });
  }
}

export async function createActivity(userId: string, raw: ActivityInput): Promise<{ activityId: string; effects: ActivityEffects }> {
  const input = activityInputSchema.parse(raw);
  const existing = await prisma.activity.findUnique({ where: { clientRequestId: input.clientRequestId }, select: { id: true, userId: true } });
  if (existing) {
    if (existing.userId !== userId) throw new AuthError("FORBIDDEN");
    return { activityId: existing.id, effects: { scoring: [], badges: [] } };
  }
  const startedAt = zonedToUtc(input.localDate, input.localTime, await userTz(userId));
  const after = await prisma.$transaction(async (tx) => {
    await assertRoutineOwner(tx, userId, input.routineId);
    const a = await tx.activity.create({
      data: { userId, activityCategoryId: input.activityCategoryId, routineId: input.routineId ?? null, startedAt, durationMinutes: input.durationMinutes, notes: input.notes ?? null, clientRequestId: input.clientRequestId },
      select: snapshotSelect,
    });
    await writeExercises(tx, a.id, input.exercises);
    return a;
  });
  const effects = await runActivityEffects({ userId, before: null, after });
  return { activityId: after.id, effects };
}

async function loadOwned(userId: string, activityId: string): Promise<ActivitySnapshot> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: snapshotSelect });
  if (!a || a.userId !== userId) throw new AuthError("NOT_FOUND");
  return a;
}

export async function updateActivity(userId: string, activityId: string, raw: ActivityInput): Promise<{ effects: ActivityEffects }> {
  const input = activityInputSchema.parse(raw);
  const before = await loadOwned(userId, activityId);
  const startedAt = zonedToUtc(input.localDate, input.localTime, await userTz(userId));
  const after = await prisma.$transaction(async (tx) => {
    await assertRoutineOwner(tx, userId, input.routineId);
    await tx.activityExercise.deleteMany({ where: { activityId } });
    const a = await tx.activity.update({
      where: { id: activityId },
      data: { activityCategoryId: input.activityCategoryId, routineId: input.routineId ?? null, startedAt, durationMinutes: input.durationMinutes, notes: input.notes ?? null },
      select: snapshotSelect,
    });
    await writeExercises(tx, activityId, input.exercises);
    return a;
  });
  return { effects: await runActivityEffects({ userId, before, after }) };
}

export async function deleteActivity(userId: string, activityId: string): Promise<{ effects: ActivityEffects }> {
  const before = await loadOwned(userId, activityId);
  await prisma.activity.delete({ where: { id: activityId } });
  return { effects: await runActivityEffects({ userId, before, after: null }) };
}

export async function getActivityForEdit(userId: string, activityId: string): Promise<ActivityInput & { id: string }> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { exercises: { orderBy: { position: "asc" }, include: { sets: { orderBy: { position: "asc" } } } } },
  });
  if (!a || a.userId !== userId) throw new AuthError("NOT_FOUND");
  const tz = await userTz(userId);
  return {
    id: a.id, clientRequestId: `edit-${a.id}`, activityCategoryId: a.activityCategoryId, routineId: a.routineId,
    localDate: localDateOf(a.startedAt, tz), localTime: localTimeOf(a.startedAt, tz), durationMinutes: a.durationMinutes, notes: a.notes,
    exercises: a.exercises.map((e) => ({
      exerciseId: e.exerciseId, notes: e.notes,
      sets: e.sets.map((s) => ({ kind: s.kind, reps: s.reps, durationSeconds: s.durationSeconds, weightKg: s.weightKg, restSeconds: s.restSeconds, completed: s.completed })),
    })),
  };
}
```

Run: `npm run test:int -- src/server/activities`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/workout.ts src/schemas/workout.test.ts src/server/activities src/server/scoring src/server/badges src/server/notifications
git commit -m "feat: single write path for activities with effects pipeline"
```

---

### Task 5: Que la app siga funcionando sobre el schema v2 (adaptación mínima)

El objetivo es que, al terminar W0-C, `rework/v2` compile y los flujos básicos funcionen: registrar, ver el perfil y ver el grupo. Hasta que W1-1 esté listo, los puntos quedan en 0. Esto es un **puente**: las pantallas definitivas las hacen W2-x.

**Files:**
- Modify: `app/api/activities/create/route.ts` → delega en `createActivity`, mapeando el formato viejo del form (`sets`, `reps`, `durationSeconds`, `weightKg` planos por ejercicio) a N series iguales.
- Modify: `app/api/activities/[id]/route.ts` → delega en `deleteActivity`.
- Modify: `app/api/routine/create/route.ts`, `app/api/routine/[id]/route.ts`, `app/api/routine/list/route.ts` → escriben y leen `RoutineSet` (N series iguales), con `position` y `orderBy: { position: "asc" }`; el PUT dentro de una transacción.
- Modify: `app/api/seasons/create/route.ts`, `app/api/seasons/update/route.ts` → escriben `startDate`/`endDate` como `localDateToDbDate("YYYY-MM-DD")` y `SeasonCategory` (peso 1); llaman a `recomputeSeason` (stub) en update.
- Modify: `app/api/seasons/finalize/route.ts` → llama a `finalizeSeason(seasonId, { publish: true })` (stub).
- Modify: `app/group/[id]/page.tsx`, `app/profile/page.tsx`, `app/home/page.tsx`, `src/components/UserActiveStats.tsx`, `src/lib/awards/*`, `src/lib/scoring/*` → todo lo que lea `type`, `endedAt`, `isDeleted`, `scoreEvent`, `seasonWeekProgress`, `allowedActivityTypeLinks`, `awardEarned` o `awardDefinition`:
  - El leaderboard lee `SeasonStanding` (vacío hasta W1-1).
  - Las etiquetas de tipo usan `activityCategory.name`.
  - La duración se lee de `durationMinutes`.
  - Los badges del perfil leen `getUserBadges` (stub → vacío).
  - Las fechas se formatean con `src/lib/time`.
- Delete: `src/lib/scoring/**` y `src/lib/awards/**` (W1-1 y W1-2 los reemplazan en `src/server/*`), `app/api/profile/update/awards/route.ts`, `app/api/seasons/leave/route.ts`, `src/components/ExerciseSelector.tsx` y los componentes muertos listados en `00-roadmap.md` §1.4.

- [ ] **Step 1:** correr `npm run typecheck` y resolver cada error con las reglas de arriba, sin agregar lógica nueva de puntos.
- [ ] **Step 2: Verificación manual con `npm run dev` (puerto 3003)**
  - Registrar un entrenamiento de fuerza con 2 ejercicios y uno de running sin ejercicios.
  - Verlos en el perfil con la hora local correcta.
  - Crear y editar una rutina con un ejercicio por tiempo.
  - Crear una temporada y verla en el grupo; el ranking queda en 0 pts por ahora.
  - Borrar un entrenamiento.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build` en verde.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: adapt existing screens and APIs to v2 schema (bridge until wave 2)"
```

---

### Verificación final de W0-C
- [ ] El diff de Prisma entre la DB y el schema está vacío.
- [ ] La migración de datos está probada con el fixture v1.
- [ ] Los flujos básicos funcionan en el dev server.
- [ ] Pedir review y merge a `rework/v2`. **El orquestador**, después de mergear, corre `npm run db:worktree` en la integración y avisa que la Ola 1 puede arrancar.
