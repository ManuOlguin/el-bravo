# W1-5 — Fotos con Cloudflare R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D8, §4, §5.8, §6.2).

**Goal:** subir fotos de actividades (hasta 4 por entrenamiento), de perfil y de grupo a Cloudflare R2, con compresión en el cliente y subida directa mediante URL prefirmada. También incluye un script para migrar a R2 las imágenes existentes que estén en otros hosts (Vercel Blob u otros).

**Architecture:**
1. El cliente comprime la imagen a WebP con `<canvas>` (máximo 1600 px de lado, calidad 0,82) y genera **también una miniatura** de 400 px (calidad 0,7), que se usa en feeds, en el widget del celular y en las notificaciones push (D12).
2. `createUploadAction` valida el permiso y el tipo, y devuelve dos URLs prefirmadas (original y miniatura): `{ uploadUrl, key, publicUrl, thumbUploadUrl, thumbKey, thumbPublicUrl }`.
3. El navegador hace `PUT` directo a R2.
4. `confirmUploadAction` verifica con `HeadObject` que el objeto exista y no supere el límite, y recién entonces escribe en la DB (`ActivityMedia` o `photoUrl`).
5. Borrar una foto borra también el objeto en R2.

**Tech Stack:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2 es compatible con S3), Canvas API.

**Spec:** `00-roadmap.md` (D8). **Depende de:** W0-B y W0-C. **Rama:** `v2/w1-5-media`. Puerto 3015.

## Global Constraints
Ver `00-roadmap.md` §4. Credenciales solo por variables de entorno. **Nunca** commitear claves.

**Configuración necesaria** (D8, decisión abierta): un bucket `elbravo-media` con acceso público de lectura por dominio (`R2_PUBLIC_BASE_URL`) y CORS que permita `PUT` desde `http://localhost:30*` y desde el dominio de producción. Para desarrollar sin cuenta, se usa **MinIO** local; ver Task 1, Step 5.

---

### Task 1: Cliente de almacenamiento + configuración

**Files:**
- Create: `src/server/media/storage.ts`
- Create: `src/server/media/keys.ts` (puro)
- Test: `src/server/media/keys.test.ts`
- Modify: `.env.example`
- Create: `docs/r2-setup.md` (cómo crear el bucket, CORS, dominio público y MinIO local)

**Interfaces:**
- Produce:

```ts
// keys.ts (puro)
export const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"] as const;
export const MAX_BYTES = 5 * 1024 * 1024;
export function mediaKey(target: UploadTarget, ext: "webp" | "jpg" | "png", rand: string): string;
// activity → `activities/<activityId>/<rand>.webp`; avatar → `avatars/<userId>/<rand>.webp`; group → `groups/<groupId>/<rand>.webp`
// miniatura: misma key con sufijo `-thumb` antes de la extensión (`<rand>-thumb.webp`)
export function thumbKeyFor(key: string): string;
export function publicUrlFor(key: string, base: string): string;
export function keyFromPublicUrl(url: string, base: string): string | null;

// storage.ts (server-only)
export async function presignPut(key: string, contentType: string): Promise<string>; // vence en 5 min
export async function headObject(key: string): Promise<{ size: number; contentType: string } | null>;
export async function deleteObject(key: string): Promise<void>;
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void>; // para el script de migración
```

Variables de entorno: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` y, opcional para MinIO, `R2_ENDPOINT`.

- [ ] **Step 1:** tests de `keys.ts`: formato de las keys, ida y vuelta entre URL y key, y que `keyFromPublicUrl` devuelva `null` para URLs de otros hosts.
- [ ] **Step 2:** implementar `storage.ts` con `S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT ?? \`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`, forcePathStyle: !!process.env.R2_ENDPOINT, credentials })`.
- [ ] **Step 3:** `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
- [ ] **Step 4:** escribir `docs/r2-setup.md` con los pasos del dashboard de Cloudflare y un JSON de CORS:

```json
[{ "AllowedOrigins": ["http://localhost:3000", "https://<dominio-prod>"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

- [ ] **Step 5:** documentar MinIO local para desarrollo:
  - `brew install minio/stable/minio`;
  - arrancarlo con `minio server ~/minio-data --console-address :9001`;
  - crear el bucket con `mc`;
  - `R2_ENDPOINT=http://127.0.0.1:9000` y `R2_PUBLIC_BASE_URL=http://127.0.0.1:9000/elbravo-media`.
- [ ] **Step 6: Commit**

```bash
git add src/server/media docs/r2-setup.md .env.example package.json package-lock.json
git commit -m "feat(media): R2 storage client and key helpers"
```

---

### Task 2: Acciones de subida/confirmación/borrado

**Files:**
- Create: `src/server/actions/media.ts`
- Test: `src/server/actions/media.int.test.ts` (mockeando `storage.ts`)

**Interfaces:**
- Produce:

```ts
export async function createUploadAction(target: UploadTarget, file: { contentType: string; size: number }): Promise<ActionResult<{ uploadUrl: string; key: string; publicUrl: string; thumbUploadUrl: string; thumbKey: string; thumbPublicUrl: string }>>;
export async function confirmUploadAction(target: UploadTarget, key: string, meta: { width: number; height: number }): Promise<ActionResult<{ id?: string; url: string }>>;
export async function deleteActivityMediaAction(mediaId: string): Promise<ActionResult<void>>;
export async function reorderActivityMediaAction(activityId: string, mediaIds: string[]): Promise<ActionResult<void>>;
```

Reglas, cada una con test:
- **Permisos por destino:**
  - `activity`: el usuario tiene que ser el dueño de la actividad.
  - `group`: tiene que ser admin del grupo (`requireGroupAdmin`).
  - `avatar`: siempre es el propio usuario.
- **Límites:** máximo 4 fotos por actividad, tipo dentro de `ALLOWED_MIME` y tamaño de hasta `MAX_BYTES`.
- **Validación de la key:** la key de confirmación tiene que empezar con el prefijo esperado para ese destino, para que no se puedan confirmar keys de otro usuario.
- **Confirmación:**
  - `headObject` tiene que existir, con un tamaño de hasta `MAX_BYTES`.
  - Para `activity`, crea `ActivityMedia` con `position` = cantidad actual de fotos y `thumbUrl` (si la miniatura existe en el bucket; si no, `null` y la UI usa la original).
  - Para `avatar`/`group`, actualiza `photoUrl` y borra el objeto anterior si estaba en el bucket propio.
- **Borrado:** si se borra la actividad (servicio de W0-C), las fotos se borran del bucket. Para eso, agregar en `src/server/activities/service.ts → deleteActivity` una llamada a `deleteActivityObjects(activityId)` **antes** del `delete`, exportada desde `src/server/media`. Es una **excepción de propiedad acordada**: es una sola línea, y el orquestador la revisa en el merge.

- [ ] **Step 1:** escribir los tests.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** correr hasta PASS.
- [ ] **Step 4: Commit**

```bash
git add src/server/actions/media.ts src/server/media src/server/activities/service.ts
git commit -m "feat(media): presigned upload, confirm and delete actions"
```

---

### Task 3: Componentes cliente

**Files:**
- Create: `src/features/media/compress.ts` (Canvas → WebP en dos tamaños, 1600 px y 400 px de miniatura; lógica de tamaño pura en `fitWithin`)
- Test: `src/features/media/compress.test.ts` (solo `fitWithin(w, h, max)`)
- Create: `src/features/media/upload.ts` (`uploadFile(target, file)`, que encadena crear → PUT → confirmar; y `uploadPendingPhotos(activityId, files)`)
- Create: `src/features/media/PhotoUploader.tsx`
- Create: `src/features/media/PendingPhotoPicker.tsx`
- Create: `src/features/media/PhotoGrid.tsx` (muestra fotos con visor a pantalla completa)
- Create: `src/features/media/index.ts`

**Interfaces:** §5.8 + `<PhotoGrid photos={{ id?: string; url: string }[]} onDelete?(id) />`.

**Comportamiento:**
- **`PendingPhotoPicker`:** se usa en el formulario de entrenamiento antes de que exista la actividad.
  - Abre la cámara o la galería con `<input type="file" accept="image/*" capture="environment" multiple>`.
  - Muestra miniaturas con un botón ✕ y un máximo de 4 fotos.
- **`PhotoUploader`:** para el perfil, el grupo o una actividad existente. Sube en el momento, muestra el progreso con `Spinner` sobre la miniatura y avisa con `toast.error` si algo falla, con opción de reintentar.
- **`uploadPendingPhotos`:** sube en paralelo, con un máximo de 2 subidas simultáneas, y devuelve `{ uploaded, failed }`. Si alguna foto falla, **no** se pierde el entrenamiento: la UI ofrece "Reintentar fotos".
- **`PhotoGrid`:** al tocar una foto se abre un `Modal` a pantalla completa con swipe entre fotos (con botones ‹ ›, sin librería).

- [ ] **Step 1:** test de `fitWithin` (4000×3000 con máximo 1600 da 1600×1200; una imagen chica no cambia).
- [ ] **Step 2:** implementar.
- [ ] **Step 3: Catálogo `/dev/ui`.** Agregar la sección `app/dev/ui/sections/media.tsx` con un `PhotoUploader` de avatar contra MinIO.
- [ ] **Step 4: Verificación manual**
  - Subir un avatar desde `/dev/ui`.
  - Verificar en MinIO que el objeto es WebP y pesa menos de 500 KB para una foto de 12 MP.
  - Borrarlo.
- [ ] **Step 5: Commit**

```bash
git add src/features/media app/dev/ui/sections
git commit -m "feat(media): client compression, uploader, pending picker and photo grid"
```

---

### Task 4: Script de migración de imágenes existentes

**Files:**
- Create: `scripts/migrate-images-to-r2.ts`
- Test: `scripts/migrate-images-to-r2.int.test.ts` (con `fetch` y `storage` mockeados)

**Comportamiento:**
- Recorre `User.photoUrl`, `Group.photoUrl`, `ActivityMedia.url` y `Exercise.mediaUrl` (este último solo si se pasa el flag `--exercises`).
- Para cada URL que **no** empieza con `R2_PUBLIC_BASE_URL`:
  1. La descarga con un timeout de 15 s y verifica que el `content-type` sea de imagen.
  2. Si pesa más de 1 MB, la recomprime con `sharp`, agregado como devDependency **solo para este script**.
  3. La sube con `putObject` y actualiza la fila.
- Escribe un reporte CSV en `scripts/out/migrate-images-<fecha>.csv` con las columnas tabla, id, url_vieja, url_nueva y estado.
- Tiene un modo `--dry-run`, que no escribe nada, y un modo `--limit N`.
- Es idempotente: una segunda corrida no hace nada.
- Si una URL da 404, la deja tal cual y la marca como `failed` en el reporte. **No** pone `null`.

- [ ] **Step 1:** escribir los tests (dry-run sin escrituras, idempotencia, 404 → failed, URL ya en R2 → skip).
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** documentar en `docs/r2-setup.md` cómo correrlo contra producción: **primero un backup** con `mysqldump`, después `--dry-run`, revisar el CSV y recién entonces la corrida real. W3 lo ejecuta.
- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-images-to-r2.ts scripts/migrate-images-to-r2.int.test.ts docs/r2-setup.md package.json package-lock.json
git commit -m "feat(media): idempotent script to migrate existing images to R2"
```

---

### Verificación final de W1-5
- [ ] Gates verdes.
- [ ] Subida de avatar y de foto de grupo funcionando de punta a punta contra MinIO, y contra R2 real si ya hay credenciales.
- [ ] Pedir review y merge. W2-1 integra `PendingPhotoPicker` y `uploadPendingPhotos` en el registro de entrenamientos; W2-2 integra la foto de grupo.
