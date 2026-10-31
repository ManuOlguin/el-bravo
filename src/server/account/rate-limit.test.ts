import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, resetRateLimit, __clearRateLimits } from "./rate-limit";

describe("rateLimit (ventana deslizante en memoria)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
    __clearRateLimits();
  });
  afterEach(() => vi.useRealTimers());

  const opts = { max: 5, windowMs: 15 * 60_000 };

  it("deja pasar hasta `max` intentos y bloquea el siguiente", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("k", opts)).toEqual({ ok: true, retryAfterS: 0 });
    const r = rateLimit("k", opts);
    expect(r.ok).toBe(false);
    expect(r.retryAfterS).toBe(15 * 60);
  });

  it("las claves son independientes", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", opts);
    expect(rateLimit("a", opts).ok).toBe(false);
    expect(rateLimit("b", opts).ok).toBe(true);
  });

  it("retryAfter se calcula desde el intento más viejo dentro de la ventana", () => {
    rateLimit("k", opts); // t=0
    vi.advanceTimersByTime(5 * 60_000);
    for (let i = 0; i < 4; i++) rateLimit("k", opts); // t=5min
    const r = rateLimit("k", opts);
    expect(r.ok).toBe(false);
    expect(r.retryAfterS).toBe(10 * 60);
  });

  it("la ventana se desliza: al vencer el más viejo, vuelve a haber lugar", () => {
    rateLimit("k", opts); // t=0
    vi.advanceTimersByTime(60_000);
    for (let i = 0; i < 4; i++) rateLimit("k", opts); // t=1min
    expect(rateLimit("k", opts).ok).toBe(false);
    vi.advanceTimersByTime(14 * 60_000 + 1); // vence el de t=0
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(false);
  });

  it("los intentos bloqueados no extienden el bloqueo", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", opts);
    for (let i = 0; i < 10; i++) rateLimit("k", opts);
    vi.advanceTimersByTime(15 * 60_000 + 1);
    expect(rateLimit("k", opts).ok).toBe(true);
  });

  it("resetRateLimit limpia la clave", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", opts);
    resetRateLimit("k");
    expect(rateLimit("k", opts).ok).toBe(true);
  });
});
