// Configura el email por SMTP (recuperar contraseña, notificaciones, resumen semanal) en .env.production.local
// y manda un mail de prueba antes de guardar. La contraseña se escribe sin mostrarse y nunca se imprime.
// Con Gmail: activá la verificación en 2 pasos y creá una "contraseña de aplicación" en
// https://myaccount.google.com/apppasswords (16 letras). No uses tu contraseña normal.
//   node scripts/prod/set-email.mjs
import { existsSync } from "node:fs";
import { ENV_FILE, createPrompt, readEnv, writeEnv } from "./prompt.mjs";

if (!existsSync(ENV_FILE)) {
  console.error(`✗ No existe ${ENV_FILE} (lo genera el kit de deploy).`);
  process.exit(1);
}

const { ask, askHidden, close } = createPrompt();
console.log("Email por SMTP (por ejemplo Gmail con contraseña de aplicación). La contraseña no se muestra.\n");
const host = await ask("Servidor SMTP", readEnv("EMAIL_HOST") || "smtp.gmail.com");
const port = await ask("Puerto", readEnv("EMAIL_PORT") || "587");
const user = await ask("Usuario (tu mail)", readEnv("EMAIL_USER"));
const password = ((await askHidden("Contraseña de aplicación")) || readEnv("EMAIL_PASSWORD")).replace(/\s+/g, "");
const testTo = await ask("Mandar un mail de prueba a", user);
close();

if (!host || !/^\d+$/.test(port) || !/^[^@\s]+@[^@\s]+$/.test(user) || !password) {
  console.error("✗ Faltan datos. No se cambió nada.");
  process.exit(1);
}

const { default: nodemailer } = await import("nodemailer");
const from = `El Bravo <${user}>`;
try {
  const transporter = nodemailer.createTransport({ host, port: Number(port), secure: Number(port) === 465, auth: { user, pass: password } });
  await transporter.verify();
  await transporter.sendMail({
    from,
    to: testTo,
    subject: "El Bravo: prueba de email",
    text: "Si te llegó este mail, el email de El Bravo está configurado (recuperar contraseña y notificaciones).",
  });
  console.log(`✓ SMTP conecta y se mandó un mail de prueba a ${testTo} (revisá también el spam).`);
} catch (e) {
  console.error(`✗ No se pudo mandar: ${String(e.message ?? e).split("\n")[0]}`);
  console.error("  Con Gmail: tiene que ser una contraseña de aplicación, no la normal. No se cambió nada.");
  process.exit(1);
}

writeEnv({ EMAIL_HOST: host, EMAIL_PORT: port, EMAIL_USER: user, EMAIL_PASSWORD: password, EMAIL_FROM: from });
console.log(`✓ Guardado en ${ENV_FILE}.`);
