// Preguntas en la terminal para los scripts de producción. Con terminal real, `askHidden` no muestra lo que
// se escribe (claves, secretos). Sin terminal (respuestas por pipe, para probar) lee las líneas en orden.
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

export const ENV_FILE = ".env.production.local";

export function createPrompt() {
  const tty = !!process.stdin.isTTY;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  const lines = tty ? null : rl[Symbol.asyncIterator]();
  let muted = false;
  const writeToOutput = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (s) => {
    if (!muted) writeToOutput(s);
    else if (s.includes("\n") || s.includes("\r")) writeToOutput("\n");
  };
  const question = async (q) => {
    if (lines) {
      process.stdout.write(q);
      const { value } = await lines.next();
      process.stdout.write("\n");
      return value ?? "";
    }
    return new Promise((res) => rl.question(q, res));
  };
  return {
    ask: async (q, def) => (await question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || "",
    askHidden: (q) => {
      if (lines) return question(`${q}: `);
      return new Promise((res) => {
        rl.question(`${q}: `, (a) => {
          muted = false;
          res(a.trim());
        });
        muted = true; // después de imprimir la pregunta
      });
    },
    close: () => rl.close(),
  };
}

/** Valor actual de una variable del archivo ("" si falta o dice COMPLETAR). */
export function readEnv(name) {
  const m = readFileSync(ENV_FILE, "utf8").match(new RegExp(`^${name}="?([^"\\n]*)"?$`, "m"));
  return m && !m[1].includes("COMPLETAR") ? m[1] : "";
}

/** Escribe (o agrega) variables en el archivo, con permisos solo para el usuario. */
export function writeEnv(vars) {
  let content = readFileSync(ENV_FILE, "utf8");
  for (const [name, value] of Object.entries(vars)) {
    const line = `${name}="${value}"`;
    const re = new RegExp(`^${name}=.*$`, "m");
    content = re.test(content) ? content.replace(re, () => line) : `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(ENV_FILE, content);
  chmodSync(ENV_FILE, 0o600);
}
