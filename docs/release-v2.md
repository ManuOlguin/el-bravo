# Release de El Bravo v2 a producción

Guía paso a paso. Los pasos marcados **(vos)** necesitan tus cuentas; el resto lo corre Claude o un script.
Los secretos viven en `.env.production.local` (ignorado por git, permisos solo para tu usuario). **Nunca** se pegan en el chat ni se commitean.

## Decisiones

- **Dónde quedó (31-oct-2026):** como no hubo acceso al Vercel de Leo, v2 se publicó desde **`ManuOlguin/el-bravo` (`main`)** en un proyecto de Vercel propio, en **https://elbravo.vercel.app**. `el-bravo-prod` sigue con la versión de abril; para pasarla ahí, ver abajo (Leo carga las variables o transfiere el proyecto; el push es fast-forward).
- **Plan original — repo de producción: [`LeonardoMelman/el-bravo-prod`](https://github.com/LeonardoMelman/el-bravo-prod), rama `main`.** Es el que está conectado al proyecto de Vercel. `ManuOlguin/el-bravo` quedó congelado el 2 de abril; v2 se hizo sobre ese y después se unió la historia de el-bravo-prod (merge sin traer su código: v2 lo reescribió). Lo que v2 no tenía se portó: recuperar contraseña, temas Leo/Manu, Novedades y frases.
- **Base de datos: TiDB Cloud Starter.** Compatible con MySQL, plan gratis, no se borra por inactividad (la de Aiven se borró por eso, D13). Arranca vacía: v2 no migra datos de la versión vieja.
- **Región:** AWS `us-east-1` (Virginia) para la base, y la misma para las funciones de Vercel (`iad1`, la que usa Vercel por defecto). App y base juntas = consultas rápidas.
- **Fotos:** Cloudflare R2 (ver [`r2-setup.md`](r2-setup.md)).
- **Crons diarios** (`vercel.json`): el plan gratis de Vercel solo permite uno por día por cron. Alcanza: los push se mandan en el momento; el cron solo reintenta, avisa inicios de temporada y manda el resumen de los lunes.
  - `/api/cron/seasons` → 03:15 UTC (00:15 en Argentina): cierra temporadas terminadas.
  - `/api/cron/notifications` → 12:30 UTC (09:30 en Argentina).
- **Email:** SMTP (por ejemplo Gmail con contraseña de aplicación), como usaba el-bravo-prod. Sirve para recuperar contraseña y para las notificaciones por mail, sin dominio propio. Resend queda como opción si algún día hay dominio.
- **IA (opcional): OpenAI** (spec de rutinas, R1). Chat Completions con salida estructurada (JSON Schema estricto), sin SDK. Modelo por `OPENAI_MODEL` (por defecto `gpt-4.1-mini`). Sin `OPENAI_API_KEY` la app anda igual: solo no aparece "Leer con IA". Se puede importar desde texto pegado o desde archivos: Word/Excel/texto se leen en el navegador (los archivos nunca se suben; si tocás "Leer con IA", el TEXTO extraído se manda a OpenAI); fotos (hasta 4, achicadas a 1600 px) o un PDF (≤ 10 páginas) se mandan a OpenAI junto con los nombres de los ejercicios del usuario (con `store: false`). Ni el texto ni los archivos se guardan (ni en la base ni en R2) ni se loguean. La IA devuelve hasta 7 rutinas por importación; se crean juntas, privadas. Límite: 20 importaciones con IA por usuario por día, una por importación aunque tenga 4 fotos o 7 rutinas (en memoria por instancia). Costo: las fotos y el PDF gastan más tokens que el texto (con `gpt-4.1-mini`, unos 2,5 mil tokens por imagen: del orden de pocos centavos de dólar por importación); el límite mensual del proyecto en OpenAI (paso 3) lo acota. `OPENAI_MODEL` tiene que aceptar imágenes y PDF (`gpt-4.1-mini` sí; `gpt-4o-mini` no conviene: multiplica los tokens de cada imagen y 4 capturas altas pasan su contexto de 128k). Las Server Actions aceptan hasta 4,5 MB (`next.config.ts`).

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

**IA (opcional) — OpenAI (vos):**
1. En <https://platform.openai.com> → **Projects** → crear un proyecto `El Bravo` (así el gasto queda separado).
2. En el proyecto → **Limits** → poner un **límite mensual** de gasto (por ejemplo USD 5) y un aviso por mail antes de llegar.
3. **API keys** → **Create new secret key** en ese proyecto (permisos "Restricted" alcanza si incluye *Model capabilities → Write*; "All" también sirve).
4. Pegarla vos en `.env.production.local` como `OPENAI_API_KEY="sk-…"` (nunca en el chat). Opcional: `OPENAI_MODEL` para cambiar de modelo sin tocar código.
5. `node scripts/prod/check-env.mjs --ping` → tiene que decir `✓ OpenAI: la key funciona…` (o el aviso de key restringida).

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
   - `OPENAI_API_KEY` (marcarla **Sensitive**) y, si se usa, `OPENAI_MODEL`. Son opcionales: sin ellas no aparece "Leer con IA". Las variables nuevas se toman en el **próximo** deploy.
   - **Fluid Compute** activado en Settings → Functions (ya está activado en el proyecto; la importación con IA espera hasta 85 s y `/routines/import` tiene `maxDuration = 120`; Hobby con Fluid Compute permite hasta 300 s). Si alguna vez se desactiva, en Hobby el límite pasa a 60 s: bajar `maxDuration` a 60 y el timeout de la IA a 50 s (ver el plan de la fase 3b, Task 1).
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
- **La IA falla o gasta de más:** borrar `OPENAI_API_KEY` en Vercel y redeployar: "Leer con IA" y adjuntar fotos/PDF desaparecen (Word/Excel/texto siguen andando sin IA) y el resto sigue igual. Los errores de OpenAI (key, saldo, caída) quedan en los logs de Vercel como `[ai-import]` (sin el texto del usuario).

## Pendientes conocidos

- Textos de los 78 ejercicios escritos por IA, sin revisar: `npx tsx scripts/exercises/validate.ts --pending`.
- Riesgos aceptados de seguridad: ver [`security-review.md`](security-review.md) (rate limit en memoria, sin CSP, logout sin revocar el JWT).
