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
