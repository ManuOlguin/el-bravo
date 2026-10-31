// Completa en .env.production.local lo que falta para producción: APP_URL, VAPID_SUBJECT y Cloudflare R2.
// El secreto de R2 se escribe sin mostrarse y nunca se imprime. Antes de guardar prueba R2 de punta a punta,
// igual que la app: CORS desde APP_URL, subida con URL prefirmada, lectura pública y borrado del archivo de prueba.
//   node scripts/prod/set-r2.mjs
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ENV_FILE, createPrompt, readEnv, writeEnv } from "./prompt.mjs";

if (!existsSync(ENV_FILE)) {
  console.error(`✗ No existe ${ENV_FILE} (lo genera el kit de deploy).`);
  process.exit(1);
}

const { ask, askHidden, close } = createPrompt();
const httpsNoSlash = (v) => /^https:\/\/[^/\s]+(\/[^\s]*)?$/.test(v) && !v.endsWith("/");

console.log("App y notificaciones\n");
const appUrl = (await ask("URL de la app en Vercel (ej. https://el-bravo.vercel.app)", readEnv("APP_URL"))).replace(/\/+$/, "");
const email = await ask("Mail de contacto para las notificaciones push", readEnv("VAPID_SUBJECT").replace(/^mailto:/, ""));

console.log("\nCloudflare R2 (dash.cloudflare.com → R2). El secret no se muestra mientras lo escribís.\n");
const accountId = (await ask("Account ID (32 caracteres)", readEnv("R2_ACCOUNT_ID"))).toLowerCase();
const accessKeyId = await ask("Access Key ID", readEnv("R2_ACCESS_KEY_ID"));
const secret = (await askHidden("Secret Access Key")) || readEnv("R2_SECRET_ACCESS_KEY");
const bucket = await ask("Bucket", readEnv("R2_BUCKET") || "elbravo-media");
const publicBase = (await ask("URL pública del bucket (ej. https://pub-xxxx.r2.dev)", readEnv("R2_PUBLIC_BASE_URL"))).replace(/\/+$/, "");
close();

const problems = [
  !httpsNoSlash(appUrl) && "APP_URL tiene que ser https://…",
  !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && "el mail no parece válido",
  !/^[0-9a-f]{32}$/.test(accountId) && "el Account ID son 32 caracteres hexadecimales",
  accessKeyId.length < 20 && "falta el Access Key ID",
  secret.length < 40 && "falta el Secret Access Key",
  !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) && "nombre de bucket inválido",
  !httpsNoSlash(publicBase) && "la URL pública del bucket tiene que ser https://…",
].filter(Boolean);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error("No se cambió nada.");
  process.exit(1);
}

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = await import("@aws-sdk/client-s3");
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey: secret },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

let failed = false;
const step = async (name, fn) => {
  try {
    const detail = await fn();
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  } catch (e) {
    failed = true;
    console.log(`✗ ${name}: ${e.name && e.name !== "Error" ? `${e.name} ` : ""}${String(e.message ?? e).split("\n")[0]}`);
    return false;
  }
};

console.log("");
await step("Token y bucket", async () => {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
});

const key = `_deploy-check/${randomUUID()}.txt`;
const body = new TextEncoder().encode("El Bravo: prueba de deploy\n");

await step(`CORS desde ${appUrl}`, async () => {
  // El navegador hace este "preflight" antes de subir una foto a R2.
  const res = await fetch(`${endpoint}/${bucket}/${key}`, {
    method: "OPTIONS",
    headers: { Origin: appUrl, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
  });
  const allowed = res.headers.get("access-control-allow-origin");
  if (allowed !== appUrl && allowed !== "*") throw new Error(`R2 no permite ${appUrl} (falta en la CORS policy del bucket)`);
});

const uploaded = await step("Subida con URL prefirmada (como la app)", async () => {
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "text/plain", ContentLength: body.length }),
    { expiresIn: 120, signableHeaders: new Set(["content-type", "content-length"]) }
  );
  const res = await fetch(url, { method: "PUT", body, headers: { "content-type": "text/plain" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

if (uploaded) {
  await step("Lectura por la URL pública", async () => {
    const res = await fetch(`${publicBase}/${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} (¿está activado el acceso público del bucket?)`);
  });
  await step("Borrado del archivo de prueba", async () => {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  });
}

if (failed) {
  console.error("\nNo se guardó nada. Corregí lo que falló (ver docs/r2-setup.md) y volvé a correr.");
  process.exit(1);
}

writeEnv({
  APP_URL: appUrl,
  VAPID_SUBJECT: `mailto:${email}`,
  R2_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secret,
  R2_BUCKET: bucket,
  R2_PUBLIC_BASE_URL: publicBase,
});
console.log(`\n✓ Guardado en ${ENV_FILE}. Siguiente: node scripts/prod/check-env.mjs --ping`);
