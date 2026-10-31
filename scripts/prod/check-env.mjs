// Revisa .env.production.local antes del deploy: que no falte nada y que cada valor tenga la forma
// esperada. Nunca imprime los valores (solo OK / qué falta).
//   node scripts/prod/check-env.mjs           → revisa el archivo
//   node scripts/prod/check-env.mjs --ping    → además se conecta a la base y a R2
import { readFileSync, existsSync } from "node:fs";

const FILE = ".env.production.local";
if (!existsSync(FILE)) {
  console.error(`✗ No existe ${FILE}`);
  process.exit(1);
}

const env = {};
for (const line of readFileSync(FILE, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

const isUrl = (v, protocols) => {
  try {
    return protocols.includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

const checks = [
  ["DATABASE_URL", (v) => isUrl(v, ["mysql:"]) || "tiene que empezar con mysql://"],
  ["DATABASE_URL", (v) => /[?&](sslaccept=strict|ssl=true|sslmode=)/.test(v) || "falta ?sslaccept=strict al final (las bases en la nube exigen TLS)"],
  ["JWT_SECRET", (v) => v.length >= 32 || "muy corto (mínimo 32 caracteres)"],
  ["CRON_SECRET", (v) => v.length >= 32 || "muy corto (mínimo 32 caracteres)"],
  ["APP_URL", (v) => (isUrl(v, ["https:"]) && !v.endsWith("/")) || "tiene que ser https://… sin barra final"],
  ["R2_ACCOUNT_ID", (v) => /^[0-9a-f]{32}$/.test(v) || "son 32 caracteres hexadecimales (Cloudflare → R2 → Account ID)"],
  ["R2_ACCESS_KEY_ID", (v) => v.length >= 20 || "falta (token de API de R2)"],
  ["R2_SECRET_ACCESS_KEY", (v) => v.length >= 40 || "falta (token de API de R2)"],
  ["R2_BUCKET", (v) => /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(v) || "nombre de bucket inválido"],
  ["R2_PUBLIC_BASE_URL", (v) => (isUrl(v, ["https:"]) && !v.endsWith("/")) || "tiene que ser https://… sin barra final (dominio r2.dev o propio)"],
  ["VAPID_PUBLIC_KEY", (v) => v.length > 80 || "falta (npx web-push generate-vapid-keys)"],
  ["VAPID_PRIVATE_KEY", (v) => v.length > 40 || "falta"],
  ["VAPID_SUBJECT", (v) => /^mailto:[^@\s]+@[^@\s]+$|^https:\/\//.test(v) || "tiene que ser mailto:tu@mail.com"],
];

let failed = 0;
const seen = new Set();
for (const [name, check] of checks) {
  const v = env[name] ?? "";
  if (seen.has(name) && (!v || v.includes("COMPLETAR"))) continue; // "falta" se dice una sola vez
  const result = !v || v.includes("COMPLETAR") ? "falta completarla" : check(v);
  if (result !== true) {
    failed++;
    console.log(`✗ ${name}: ${result}`);
  } else if (!seen.has(name)) {
    console.log(`✓ ${name}`);
  }
  seen.add(name);
}
// Email: opcional (sin él no hay recuperar contraseña ni mails), pero si se configura tiene que estar completo.
const smtp = ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASSWORD"].filter((k) => env[k]);
if (smtp.length === 0 && !env.RESEND_API_KEY) console.log("· Email: sin configurar (opcional: node scripts/prod/set-email.mjs)");
else if (smtp.length > 0 && smtp.length < 3) {
  failed++;
  console.log("✗ Email: faltan EMAIL_HOST, EMAIL_USER o EMAIL_PASSWORD (correr node scripts/prod/set-email.mjs)");
} else console.log(`✓ Email (${env.RESEND_API_KEY ? "Resend" : "SMTP"})`);
if (env.R2_ENDPOINT) {
  failed++;
  console.log("✗ R2_ENDPOINT: es solo para MinIO local; en producción tiene que no estar");
}

if (failed > 0) {
  console.log(`\n${failed} problema(s). Corregí ${FILE} y volvé a correr.`);
  process.exit(1);
}
console.log("\nTodo completo.");

if (process.argv.includes("--ping")) {
  const { default: mariadb } = await import("mariadb");
  const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
  // Misma traducción URL → config que usa la app (TLS incluido). tsx no hace falta: es JS plano.
  const u = new URL(env.DATABASE_URL);
  try {
    const conn = await mariadb.createConnection({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.slice(1)),
      ssl: { rejectUnauthorized: true },
      connectTimeout: 10_000,
    });
    const [row] = await conn.query("SELECT VERSION() AS v");
    console.log(`✓ Base de datos: conecta (${row.v})`);
    await conn.end();
  } catch (e) {
    failed++;
    console.log(`✗ Base de datos: ${e.code ?? ""} ${e.message.split("\n")[0]}`);
  }
  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
    await s3.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET }));
    console.log("✓ R2: el bucket existe y el token tiene acceso");
  } catch (e) {
    failed++;
    console.log(`✗ R2: ${e.name ?? ""} ${e.message ?? ""}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}
