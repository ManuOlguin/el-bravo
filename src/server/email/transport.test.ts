import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { emailProvider, getMailSender } from "./transport";

describe("emailProvider", () => {
  it("Resend tiene prioridad; si no, SMTP con host, usuario y clave; si no, apagado", () => {
    expect(emailProvider({ RESEND_API_KEY: "re_x", EMAIL_HOST: "smtp.gmail.com", EMAIL_USER: "a", EMAIL_PASSWORD: "b" })).toBe("resend");
    expect(emailProvider({ EMAIL_HOST: "smtp.gmail.com", EMAIL_USER: "yo@gmail.com", EMAIL_PASSWORD: "app-pass" })).toBe("smtp");
    expect(emailProvider({ EMAIL_HOST: "smtp.gmail.com", EMAIL_USER: "yo@gmail.com" })).toBeNull();
    expect(emailProvider({})).toBeNull();
  });

  it("sin proveedor no hay sender", () => {
    expect(getMailSender({})).toBeNull();
    expect(getMailSender({ EMAIL_HOST: "smtp.gmail.com", EMAIL_USER: "yo@gmail.com", EMAIL_PASSWORD: "x" })).toBeTypeOf("function");
  });
});
