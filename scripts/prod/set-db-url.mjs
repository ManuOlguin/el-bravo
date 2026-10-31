// Arma DATABASE_URL en .env.production.local a partir de los datos de TiDB Cloud (o cualquier MySQL con TLS),
// pidiéndolos en la terminal. La clave se escribe sin mostrarse y nunca se imprime.
// Después prueba la conexión y crea la base si no existe.
//   node scripts/prod/set-db-url.mjs
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { createInterface } from "node:readline";

const FILE = ".env.production.local";
if (!existsSync(FILE)) {
  console.error(`✗ No existe ${FILE} (lo genera el kit de deploy).`);
  process.exit(1);
}

const tty = !!process.stdin.isTTY;
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
// Sin terminal (respuestas por pipe, para probar el script) se leen las líneas en orden.
const lines = tty ? null : rl[Symbol.asyncIterator]();
const question = async (q) => {
  if (lines) {
    process.stdout.write(q);
    const { value } = await lines.next();
    process.stdout.write("\n");
    return value ?? "";
  }
  return new Promise((res) => rl.question(q, res));
};
const ask = async (q, def) => (await question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || "";

/** Pregunta sin mostrar lo que se escribe (para la clave): readline escribe el eco por `_writeToOutput`. */
let muted = false;
const writeToOutput = rl._writeToOutput.bind(rl);
rl._writeToOutput = (s) => {
  if (!muted) writeToOutput(s);
  else if (s.includes("\n") || s.includes("\r")) writeToOutput("\n");
};
function askHidden(q) {
  if (lines) return question(`${q}: `);
  return new Promise((res) => {
    rl.question(`${q}: `, (a) => {
      muted = false;
      res(a);
    });
    muted = true; // después de imprimir la pregunta
  });
}

console.log("Datos de la pantalla Connect de TiDB Cloud (la clave no se muestra mientras la escribís).\n");
const host = await ask("Host (ej. gateway01.us-east-1.prod.aws.tidbcloud.com)");
const port = await ask("Port", "4000");
const user = await ask("User (ej. 3xAbCdEf.root)");
const password = await askHidden("Password");
const database = await ask("Nombre de la base", "elbravo");
rl.close();

if (!host || !user || !password || !/^\d+$/.test(port) || !/^[A-Za-z0-9_]+$/.test(database)) {
  console.error("✗ Faltan datos o hay alguno inválido. No se cambió nada.");
  process.exit(1);
}

const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslaccept=strict`;

// Probar antes de guardar: conecta sin base, la crea si falta y verifica que se pueda usar.
const { default: mariadb } = await import("mariadb");
try {
  const conn = await mariadb.createConnection({ host, port: Number(port), user, password, ssl: { rejectUnauthorized: true }, connectTimeout: 15_000 });
  const [v] = await conn.query("SELECT VERSION() AS v");
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await conn.query(`USE \`${database}\``);
  await conn.end();
  console.log(`✓ Conecta con TLS (${v.v}) y la base «${database}» está lista.`);
} catch (e) {
  console.error(`✗ No se pudo conectar: ${e.code ?? ""} ${String(e.message).split("\n")[0]}`);
  console.error("  Revisá host, usuario y clave (en TiDB: Connect → Generate Password para una nueva). No se cambió nada.");
  process.exit(1);
}

const content = readFileSync(FILE, "utf8");
const line = `DATABASE_URL="${url}"`;
const next = /^DATABASE_URL=.*$/m.test(content) ? content.replace(/^DATABASE_URL=.*$/m, () => line) : `${content}\n${line}\n`;
writeFileSync(FILE, next);
chmodSync(FILE, 0o600);
console.log(`✓ DATABASE_URL guardada en ${FILE} (no se mostró ni se subió a ningún lado).`);
