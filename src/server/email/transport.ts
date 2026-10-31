import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";

/**
 * Canal de email único (notificaciones, resumen semanal, recuperar contraseña):
 * - Resend si está `RESEND_API_KEY` (necesita dominio propio verificado para mandarle a cualquiera).
 * - Si no, SMTP si están `EMAIL_HOST`, `EMAIL_USER` y `EMAIL_PASSWORD` (por ejemplo Gmail con una
 *   contraseña de aplicación: funciona sin dominio propio). `EMAIL_PORT` por defecto 587; 465 = TLS directo.
 * - Si no hay ninguno, el email queda apagado (`getMailSender()` devuelve null) y nadie falla.
 */

export type MailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey?: string };
/** Envía o lanza. */
export type MailSender = (m: MailMessage) => Promise<void>;

type Env = Record<string, string | undefined>;

export function emailProvider(env: Env = process.env): "resend" | "smtp" | null {
  if (env.RESEND_API_KEY) return "resend";
  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD) return "smtp";
  return null;
}

export function getMailSender(env: Env = process.env): MailSender | null {
  const provider = emailProvider(env);
  if (provider === "resend") {
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.EMAIL_FROM || "El Bravo <onboarding@resend.dev>";
    return async (m) => {
      const { error } = await resend.emails.send(
        { from, to: m.to, subject: m.subject, html: m.html, text: m.text },
        m.idempotencyKey ? { idempotencyKey: m.idempotencyKey } : undefined
      );
      if (error) throw new Error(`Resend: ${error.message}`);
    };
  }
  if (provider === "smtp") {
    const port = Number(env.EMAIL_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port,
      secure: port === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    });
    const from = env.EMAIL_FROM || `El Bravo <${env.EMAIL_USER}>`;
    return async (m) => {
      await transporter.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    };
  }
  return null;
}
