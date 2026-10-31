# Fotos: Cloudflare R2 (y MinIO local)

El Bravo guarda las fotos (actividades, avatares y grupos) en un bucket S3-compatible (roadmap D8):

1. El navegador comprime a WebP (máx. 1600 px) y genera una miniatura de 400 px.
2. `createUploadAction` devuelve dos URLs prefirmadas (`PUT`, vencen en 5 min).
3. El navegador sube directo al bucket.
4. `confirmUploadAction` verifica el objeto con `HeadObject` y recién ahí escribe en la DB.

Las lecturas van por el dominio público del bucket (`R2_PUBLIC_BASE_URL`). Las keys son:

| Destino   | Original                              | Miniatura                                   |
|-----------|---------------------------------------|---------------------------------------------|
| Actividad | `activities/<activityId>/<rand>.webp` | `activities/<activityId>/<rand>-thumb.webp` |
| Avatar    | `avatars/<userId>/<rand>.webp`        | `avatars/<userId>/<rand>-thumb.webp`        |
| Grupo     | `groups/<groupId>/<rand>.webp`        | `groups/<groupId>/<rand>-thumb.webp`        |

(Si el navegador no puede codificar WebP, por ejemplo Safari, se usa `.jpg`.)

## Variables de entorno

| Variable               | Ejemplo                                    | Notas                                                   |
|------------------------|--------------------------------------------|---------------------------------------------------------|
| `R2_ACCOUNT_ID`        | `0123456789abcdef…`                        | Arma el endpoint `https://<id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID`     |                                            | Del API token de R2                                     |
| `R2_SECRET_ACCESS_KEY` |                                            | Del API token de R2. **Nunca** commitearlo              |
| `R2_BUCKET`            | `elbravo-media`                            |                                                         |
| `R2_PUBLIC_BASE_URL`   | `https://media.tudominio.com`              | Sin barra final                                         |
| `R2_ENDPOINT`          | `http://127.0.0.1:9000`                    | **Solo MinIO local** (activa path-style). En prod, vacío |

Si faltan variables, las acciones responden "Las fotos todavía no están configuradas." en vez de romper.

## Cloudflare R2 (producción)

1. **Cuenta:** crear una cuenta en <https://dash.cloudflare.com> (gratis). En **R2 Object Storage**, activar R2. Pide un medio de pago aunque el plan gratis alcanza de sobra (10 GB, 1 M de escrituras y 10 M de lecturas por mes, sin costo de egress).
2. **Bucket:** R2 → **Create bucket** → nombre `elbravo-media`, location automática, storage class Standard.
3. **Lectura pública:** en el bucket → **Settings → Public access**:
   - Recomendado: **Custom Domains → Connect domain** (por ejemplo `media.tudominio.com`; el dominio tiene que estar en Cloudflare). Eso da caché de Cloudflare.
   - Mientras no haya dominio: **R2.dev subdomain → Allow access**. Da una URL `https://pub-<hash>.r2.dev` (con límite de tráfico; sirve para arrancar).
   - Esa URL va en `R2_PUBLIC_BASE_URL`.
4. **CORS:** en el bucket → **Settings → CORS policy → Edit** y pegar (agregar el dominio de producción y los puertos locales que se usen contra R2):

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://<dominio-prod>"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   R2 no acepta comodines en el puerto (`localhost:30*`): cada origen va completo.
5. **API token:** R2 → **Manage R2 API Tokens → Create API token**:
   - Permisos: **Object Read & Write**.
   - Specify bucket(s): solo `elbravo-media`.
   - TTL: sin vencimiento (o el que prefieras).
   - Copiar **Access Key ID** y **Secret Access Key** (el secret se muestra una sola vez) y el **Account ID** (aparece en la página de R2).
6. **Variables:** cargarlas en Vercel (Production y Preview) y en `.env.local` si se quiere probar contra R2 real. No definir `R2_ENDPOINT`.
7. **Caché (opcional):** las keys son aleatorias e inmutables. Con dominio propio conviene una Cache Rule para `media.tudominio.com/*` con "Edge TTL: 1 año".
8. **Prueba:** abrir `/dev/ui` (en `npm run dev`), sección **Fotos**, subir un avatar y verificar que aparece en el bucket.

## MinIO local (desarrollo sin cuenta)

MinIO dejó de publicar binarios en `dl.min.io` (responde 410) y el tap `minio/stable` ya no instala. Las fórmulas de Homebrew core siguen funcionando (están deprecadas, se deshabilitan en 2027):

```bash
brew install minio minio-mc

# Servidor. MinIO community no implementa CORS por bucket: el CORS es global y acepta comodines.
MINIO_API_CORS_ALLOW_ORIGIN='http://localhost:30*' \
  minio server /tmp/elbravo-minio --address 127.0.0.1:9000 --console-address 127.0.0.1:9001

# Bucket con lectura anónima (usar MC_HOST_<alias> evita guardar credenciales en ~/.mc)
export MC_HOST_elbravo=http://minioadmin:minioadmin@127.0.0.1:9000
mc mb --ignore-existing elbravo/elbravo-media
mc anonymous set download elbravo/elbravo-media
```

En `.env.local`:

```bash
R2_ENDPOINT=http://127.0.0.1:9000
R2_ACCOUNT_ID=local
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=elbravo-media
R2_PUBLIC_BASE_URL=http://127.0.0.1:9000/elbravo-media
```

Consola web: <http://127.0.0.1:9001> (usuario y contraseña `minioadmin`). Para ver objetos: `mc ls --recursive elbravo/elbravo-media`.

Si MinIO deja de instalarse, cualquier servidor S3-compatible sirve (SeaweedFS, Garage, etc.) mientras soporte URLs prefirmadas y path-style.

## Migrar imágenes existentes a R2 (W3)

`scripts/migrate-images-to-r2.ts` copia al bucket las imágenes que siguen en otros hosts (Vercel Blob, etc.) y actualiza las filas. Recorre `User.photoUrl`, `Group.photoUrl`, `ActivityMedia.url` y, con `--exercises`, `Exercise.mediaUrl`.

- Saltea las URLs que ya empiezan con `R2_PUBLIC_BASE_URL`: es idempotente y se puede cortar y volver a correr.
- Descarga con timeout de 15 s y exige `content-type: image/*`.
- Si pesa más de 1 MB o el formato no está permitido, recomprime con `sharp` a WebP (máx. 1600 px). Las fotos de actividades quedan siempre en WebP y con miniatura de 400 px (`thumbUrl`).
- Si una URL falla (404, timeout, no es imagen), la fila **queda como estaba** y el reporte la marca `failed`.
- Reporte: `scripts/out/migrate-images-<fecha>.csv` (`tabla,id,url_vieja,url_nueva,estado,detalle`; `scripts/out/` está ignorado por git).

Opciones: `--dry-run` (descarga para validar, pero no sube ni escribe en la DB), `--limit N` (procesa como mucho N filas pendientes) y `--exercises`.

`--conditions=react-server` es necesario: hace que `server-only` no falle fuera de Next.

### Contra producción

1. **Backup primero:**

   ```bash
   mysqldump --single-transaction --routines --triggers -h <host> -P <port> -u <user> -p <db> > backup-pre-r2-$(date +%F).sql
   ```

2. **Variables:** exportar `DATABASE_URL` de producción y las `R2_*` reales en la terminal (tienen prioridad sobre `.env.local`/`.env`), sin `R2_ENDPOINT`.
3. **Dry-run:**

   ```bash
   npx tsx --conditions=react-server scripts/migrate-images-to-r2.ts --dry-run
   ```

4. **Revisar el CSV:** que las `failed` sean esperables (links muertos) y que los tamaños tengan sentido.
5. **Prueba chica:** `--limit 5`, y abrir en la app un par de las filas migradas.
6. **Corrida real:** sin flags (o con `--exercises` si el catálogo tiene medios externos). Si se corta, se vuelve a correr.
7. Guardar los CSV junto con el backup.
