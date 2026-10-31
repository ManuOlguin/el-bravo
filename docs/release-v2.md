# Release de El Bravo v2 a producción

Guía paso a paso. Los pasos marcados **(vos)** necesitan tus cuentas; el resto lo corre Claude o un script.
Los secretos viven en `.env.production.local` (ignorado por git, permisos solo para tu usuario). **Nunca** se pegan en el chat ni se commitean.

## Decisiones

- **Repo de producción: [`LeonardoMelman/el-bravo-prod`](https://github.com/LeonardoMelman/el-bravo-prod), rama `main`.** Es el que está conectado al proyecto de Vercel. `ManuOlguin/el-bravo` quedó congelado el 2 de abril; v2 se hizo sobre ese y después se unió la historia de el-bravo-prod (merge sin traer su código: v2 lo reescribió). Lo que v2 no tenía se portó: recuperar contraseña, temas Leo/Manu, Novedades y frases.
- **Base de datos: TiDB Cloud Starter.** Compatible con MySQL, plan gratis, no se borra por inactividad (la de Aiven se borró por eso, D13). Arranca vacía: v2 no migra datos de la versión vieja.
- **Región:** AWS `us-east-1` (Virginia) para la base, y la misma para las funciones de Vercel (`iad1`, la que usa Vercel por defecto). App y base juntas = consultas rápidas.
- **Fotos:** Cloudflare R2 (ver [`r2-setup.md`](r2-setup.md)).
- **Crons diarios** (`vercel.json`): el plan gratis de Vercel solo permite uno por día por cron. Alcanza: los push se mandan en el momento; el cron solo reintenta, avisa inicios de temporada y manda el resumen de los lunes.
  - `/api/cron/seasons` → 03:15 UTC (00:15 en Argentina): cierra temporadas terminadas.
  - `/api/cron/notifications` → 12:30 UTC (09:30 en Argentina).
- **Email:** SMTP (por ejemplo Gmail con contraseña de aplicación), como usaba el-bravo-prod. Sirve para recuperar contraseña y para las notificaciones por mail, sin dominio propio. Resend queda como opción si algún día hay dominio.

## 1. Base de datos — TiDB Cloud (vos)

1. Crear cuenta en <https://tidbcloud.com> (con Google o GitHub).
2. **Create Cluster** → plan **Starter** (gratis) → proveedor **AWS**, región **N. Virginia (us-east-1)** → nombre `el-bravo`.
3. En el cluster: **Connect** → "Connect With: General" (o "Prisma") → **Generate Password** (guardala, se muestra una sola vez).
4. Crear la base `elbravo`: en **SQL Editor** correr `CREATE DATABASE elbravo;`.
5. Correr `node scripts/prod/set-db-url.mjs`: pide host, usuario y clave (oculta), prueba la conexión con TLS, crea la base si falta y guarda `DATABASE_URL` en `.env.production.local` (forma: `mysql://USUARIO:CLAVE@HOST:4000/elbravo?sslaccept=strict`).

## 2. Fotos — Cloudflare R2 (vos)

Seguir [`r2-setup.md`](r2-setup.md) → "Cloudflare R2 (producción)": cuenta, bucket `elbravo-media`, acceso público (`r2.dev` para arrancar), token con permiso "Object Read & Write" solo para ese bucket, y CORS con la URL de la app.

## 3. Resto de variables (script)

`node scripts/prod/set-r2.mjs` pide la URL de la app en Vercel (`APP_URL`), un mail de contacto para los push (`VAPID_SUBJECT`) y los datos de R2 (el secret, oculto). Antes de guardar prueba R2 como lo usa la app: CORS desde `APP_URL`, subida con URL prefirmada, lectura pública y borrado del archivo de prueba. Las demás (`JWT_SECRET`, `CRON_SECRET`, `VAPID_*`) ya están generadas.

**Email (opcional, recomendado):** si en el Vercel de el-bravo-prod ya están `EMAIL_HOST`, `EMAIL_USER` y `EMAIL_PASSWORD` (los usaba la versión anterior), se pueden dejar como están. Si no, `node scripts/prod/set-email.mjs` pide los datos SMTP (la contraseña, oculta), manda un mail de prueba y recién ahí los guarda. Con Gmail hace falta una contraseña de aplicación (myaccount.google.com/apppasswords).

## 4. Verificar (script)

```bash
node scripts/prod/check-env.mjs --ping
```
Revisa que no falte nada, que cada valor tenga la forma correcta, que la base conecte con TLS y que el token de R2 llegue al bucket. No imprime los valores.

## 5. Preparar la base (script, con tu confirmación)

```bash
bash scripts/prod/db-setup.sh
```
Aplica las migraciones, carga los datos base (categorías, músculos, 78 ejercicios, insignias; **sin usuarios**) y verifica que la base quede igual al schema. Pide que escribas `si` antes de tocar nada.

## 6. Vercel (vos)

Hace falta acceso al proyecto de Vercel de el-bravo-prod (si es de la cuenta de Leo, que te sume como miembro o que cargue él las variables).

1. **Settings → Git**: que esté conectado a `LeonardoMelman/el-bravo-prod` y la rama de producción sea `main`.
2. **Settings → Environment Variables** (entorno **Production**; también **Preview** si querés probar ramas):
   - Reemplazar `DATABASE_URL` (la de Aiven) y `JWT_SECRET` por los de `.env.production.local`.
   - Agregar todas las demás de `.env.production.local`.
   - `EMAIL_*`: dejar las que ya estén si funcionan, o cargar las del archivo.
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob de la versión anterior) ya no se usa: se puede borrar.
3. **Settings → Functions → Function Region**: `Washington, D.C., USA (iad1)` (la misma zona que la base).

## 7. Publicar (Claude, con tu OK)

1. `git push` de `rework/v2` a `main` de **el-bravo-prod** (es fast-forward: v2 ya contiene toda su historia). Es lo único que sale de tu máquina: se confirma antes. Necesita permiso de escritura en ese repo.
2. Vercel construye y publica solo (`prisma generate && next build`).
3. Revisar el build en Vercel y abrir `/api/health`.

## 8. Prueba en el celular (vos)

- Registrarse (la base arranca vacía: todos crean cuenta de nuevo).
- Cerrar sesión y probar "¿Olvidaste tu contraseña?" (tiene que llegar el mail).
- Instalar como app: Android → menú → "Instalar app"; iPhone → Compartir → "Agregar a inicio".
- Crear un grupo y una temporada, invitar a alguien.
- Registrar un entrenamiento **con foto** (prueba R2 de verdad).
- Activar notificaciones en Ajustes; empezar una rutina en vivo, bloquear el celular y ver el aviso del descanso.

## Si algo sale mal (rollback)

- **La app no anda:** en Vercel → **Deployments** → el deploy anterior → **Promote to Production**. No hay datos viejos que restaurar (la base es nueva).
- **Falla una migración:** la base está vacía; se puede borrar y recrear (`DROP DATABASE elbravo; CREATE DATABASE elbravo;`) y volver a correr el paso 5. Si TiDB rechaza alguna migración vieja, el plan B es unificarlas en una sola migración base (`W3-release.md`, Task 4).
- **Fotos no suben:** casi siempre es CORS del bucket (falta la URL de la app) o `R2_PUBLIC_BASE_URL` mal escrita.

## Pendientes conocidos

- Textos de los 78 ejercicios escritos por IA, sin revisar: `npx tsx scripts/exercises/validate.ts --pending`.
- Riesgos aceptados de seguridad: ver [`security-review.md`](security-review.md) (rate limit en memoria, sin CSP, logout sin revocar el JWT).
