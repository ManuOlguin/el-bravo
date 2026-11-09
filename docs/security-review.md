# Revisión de seguridad v2 (W3, 31-oct-2026)

**Alcance:** `rework/v2` completo, es decir, el código de v2 y no el diff contra `main`, que reescribe casi todo. El skill `security-review` es interactivo, así que la revisión se hizo a mano leyendo el código, con ayuda de un subagente de solo lectura. Antes de anotar cada hallazgo se verificó la consulta real.

**Foco:**
- Server Actions.
- Autorización por recurso (IDOR).
- Exposición de datos en el payload RSC.
- Rate limit.
- Cookies y tokens.
- Subida de fotos.
- Crons.

**Cobertura automática nueva:**
- `src/server/actions/auth-coverage.test.ts` importa **todo** módulo `"use server"` de `src/` y `app/`. Llama a cada export sin cookie de sesión y espera `{ ok: false, error: "Tenés que iniciar sesión." }` **antes** de tocar Prisma: el mock de la DB explota si se usa. Las excepciones públicas son `loginAction`, `registerAction` y `logoutAction`. Un export nuevo entra solo en el test.
- `e2e/social.spec.ts` verifica que el perfil ajeno no incluya el email ni en el HTML ni en el payload RSC (`RSC: 1`).
- `e2e/auth.spec.ts` cubre:
  - el bloqueo después de 5 intentos;
  - la revocación de la otra sesión al cambiar la contraseña;
  - el open redirect.

## Hallazgos y estado

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Media | **Open redirect después del login.** `/login?next=/%09/evil.com` deja en el input `"/\t/evil.com"`, que pasaba los chequeos de prefijo. El parser WHATWG descarta tabs y saltos de línea, así que el router del cliente navegaba a `//evil.com` | ✅ `8dffd2e`: `safeNextPath` rechaza caracteres de control y normaliza con `new URL()` exigiendo el mismo origen. Tiene tests unitarios y E2E |
| 2 | Media | **Borrar objetos ajenos del bucket.** `updateProfileAction` y `updateGroupAction` aceptaban cualquier URL https como `photoUrl`. Al subir una foto nueva, `confirmUpload` borraba la key "anterior", que podía ser la foto de otro usuario o de otro entrenamiento. También permitía apuntar el avatar a un host externo (píxel de seguimiento) | ✅ `2edc240`: solo se borra la key anterior si está bajo el prefijo del destino. El perfil y el grupo aceptan `null`, la URL sin cambios o una URL del bucket bajo su carpeta. `createGroup` no acepta foto |
| 3 | Media-baja | **Presigned PUT sin límite de tamaño.** Con un ticket se podía subir un objeto de cualquier tamaño (original + miniatura) sin confirmar nunca | ✅ `96ba1cf`: las dos URLs firman `Content-Length` exacto (el cliente manda `thumbSize`). Verificado contra MinIO: tamaño exacto, 200; +1 byte, 403 |
| 3b | Media (deploy) | **Checksum de cuerpo vacío en las URLs prefirmadas.** El SDK agregaba `x-amz-checksum-crc32=AAAAAA==`. MinIO lo ignora, pero S3/R2 pueden rechazar la subida real | ✅ `96ba1cf`: `requestChecksumCalculation: "WHEN_REQUIRED"`. **Verificar en R2 real (Task 4)** |
| 4 | Media-baja | **Rate limit del login.** La clave usaba la primera IP de `X-Forwarded-For`, que controla el cliente, así que rotarla daba intentos ilimitados. No había límite por email (ataque distribuido) ni por IP (password spraying), y el registro no tenía límite | ✅ `eb04bd0`: IP de los headers de la plataforma (`x-vercel-forwarded-for`/`x-real-ip`) o del último hop. Límites por IP+email (5/15 min), por email (20/15 min) y por IP (50/15 min). Registro: 10/h por IP. ⚠️ El store sigue **en memoria por instancia** (ver pendientes) |
| 5 | Baja | **Acciones que validaban o leían la DB antes de pedir sesión.** Seis acciones de temporadas buscaban la temporada por id para usuarios anónimos. Además, `ensureSeasonFinalizedIfDue` era una Server Action **pública** sin uso (disparaba finalizaciones sin sesión) | ✅ `d80c3d2`: `requireUser()` primero en temporadas, fotos e invitar/rol de grupo. Se sacó `ensureSeasonFinalizedIfDue` del módulo `"use server"`. Cubierto por el test de cobertura |
| 6 | Baja | **Invitación personal vs. expulsión.** Un token de invitación de 7 días permitía volver al grupo aunque la expulsión fuera posterior a la invitación. Seguía valiendo aunque quien invitó ya no fuera admin | ✅ `3d90e18`: se exige que quien invitó siga siendo admin y se rechazan tokens emitidos antes de la expulsión. Tiene tests de integración |
| 7 | Baja | **SSRF ciego por Web Push.** El servidor hace POST al `endpoint` de la suscripción, y se aceptaba cualquier URL https (incluidas IPs internas) | ✅ `5563b7a`: allow-list de los servicios de push (FCM, Mozilla, WNS, Apple) |
| 8 | Info | **Endurecimiento general.** No había headers de seguridad, `/api/health` (público) devolvía la cantidad de usuarios y el secreto del cron se comparaba con `!==` | ✅ `5563b7a`: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS, sin `X-Powered-By`. Health responde solo `{ ok }`. El secreto del cron se compara en tiempo constante (`isAuthorizedCron`) y sin `CRON_SECRET` sigue fallando cerrado |

Arreglos funcionales que encontraron los E2E (no son de seguridad): `b9f7aa9` (el borrador del modo en vivo perdía las últimas series al recargar) y `253b270` (el botón Seguir quedaba colgado en "Cargando…" en perfiles con grupos en común).

## Pendientes y riesgos aceptados

- **Rate limit en memoria.** En Vercel cada instancia tiene su propio contador, así que el límite efectivo escala con la cantidad de lambdas. Para la escala actual (un grupo de amigos) alcanza. Si hiciera falta, conviene pasarlo a una tabla en MySQL o a Upstash. Lo mismo vale para el límite de unirse a grupos.
- **Objetos sin confirmar en el bucket.** Si el cliente sube y nunca confirma, el objeto queda en el bucket. Recomendación para la Task 4: una regla de lifecycle en R2, o un barrido en el cron, que borre objetos sin `ActivityMedia` ni `photoUrl` después de 24 h. Opcional: rate limit de `createUploadAction` por usuario.
- **Logout no revoca el token.** `logoutAction` borra la cookie. Un JWT copiado antes sigue valiendo hasta 30 días, salvo "Cerrar sesión en todos lados" o un cambio de contraseña, que suben `tokenVersion`. Se acepta como trade-off. La alternativa sería guardar un `jti` por sesión.
- **Sin CSP.** Los scripts y estilos inline de Next necesitan nonces. Conviene hacerlo junto con el deploy real.
- **JWT de sesión sin `aud`/`iss`.** `proxy.ts` solo verifica la firma, así que un JWT de invitación cuenta como "logueado" para el redirect optimista. `dal.ts` lo rechaza igual porque no tiene `sub`, así que no hay acceso. Mejora: agregar `aud: "elbravo:session"` y verificarlo en ambos lugares. Esto invalida las sesiones existentes, así que hacerlo antes del release.
- **Modelo de visibilidad (decisión de producto).**
  - Seguir no requiere aprobación, y `canViewUserActivities` permite ver al dueño, a sus seguidores y a quienes comparten grupo. En la práctica, cualquier usuario registrado puede ver los entrenamientos de otro con solo seguirlo.
  - `/workout/[id]` le muestra a un seguidor los nombres de las temporadas y grupos del dueño, aunque no sea miembro.
  - Si se quiere privacidad, hace falta aprobar seguidores o un perfil privado.
- **Roles de grupo.** Cualquier admin puede expulsar o degradar a otro admin, incluido el creador. Confirmar si es lo deseado.
- **Otros.** `changePasswordAction` no limita intentos de la contraseña actual (requiere sesión). Las actividades pueden referenciar por id un ejercicio personalizado ajeno (los ids son cuid, impacto despreciable).

## Revisado y OK

- **Auth.**
  - `getSession` valida firma, `isActive` y `tokenVersion`.
  - `jose` con clave simétrica solo acepta HMAC, así que `alg: none` no es posible.
  - Cookie `httpOnly`, `sameSite=lax`, `secure` en producción, 30 días.
  - Toda página salvo login, registro y raíz llama a `requirePageUser`. `/dev/*` hace `notFound()` en producción.
- **Autorización por recurso en todas las acciones.**
  - Actividades: `loadOwned`; `clientRequestId` ajeno rechazado; rutina propia.
  - Rutinas: `assertOwner` y ejercicios visibles.
  - Fotos: actividad propia; `isOwnKeyFor` por prefijo; el borrado hace join por `activity.userId`; el reorden exige exactamente el mismo set.
  - Notificaciones: filtradas por `recipientId`.
  - Dispositivos: filtrados por `userId`.
  - Reacciones: `canViewUserActivities`.
  - Grupos: `requireGroupAdmin` en editar, borrar, código, expulsar, rol e invitar.
  - Temporadas: chequeo sobre el `groupId` real de la temporada.
- **Exposición de datos.** Ningún select para usuarios ajenos incluye `email`, `passwordHash`, `tokenVersion`, claves de push ni `inviteCode`. Se revisaron perfil, seguidores, búsqueda, feeds, grupo, notificaciones, reacciones y standings. Las notas solo las ve el dueño. Las páginas de grupo y temporada dan 404 a quien no es miembro, y los resultados manuales se ocultan hasta publicarse.
- **SQL.** Solo `$queryRaw` con template tagged; no hay `$queryRawUnsafe`.
- **Códigos de invitación.** 40 bits con `crypto.randomInt`, vencen a los 7 días y joinear tiene rate limit.
- **Emails.** Escapan todo lo interpolado.
- **CSRF.** Las Server Actions tienen el chequeo de Origin de Next y no hay GET que muten.
- **Path traversal en keys de fotos.** Bloqueado por el regex de segmentos y el chequeo de `..`.
- **Tamaño del body de las Server Actions.** Para importar fotos/PDF, `serverActions.bodySizeLimit` es 4,5 MB (Vercel corta ahí). Es global y Next lee el body completo antes de correr la acción, así que `requireUser()` no lo limita (login, registro y reset son públicos). `proxy.ts` responde 413 a todo POST con `next-action` y `content-length` > 1 MiB fuera de `/routines/import`; en esa ruta el proxy ya exige sesión. Un request con `Transfer-Encoding: chunked` y sin `content-length` no lo detecta el proxy (Vercel igual corta a 4,5 MB).
- **Zip bomb en Word/Excel (aceptado en el MVP).** Los .docx/.xlsx se descomprimen solo en el navegador del propio usuario (nunca en el servidor), así que el peor caso es que se cuelgue su pestaña; no se agregó un tope de tamaño descomprimido.
