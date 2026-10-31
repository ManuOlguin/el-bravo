import { describe, it, expect } from "vitest";
import {
  DEFAULT_TZ, localDateOf, localTimeOf, weekKeyOf, weekKeyOfLocalDate, addDays, addWeeks,
  weekKeysBetween, daysInWeekWithin, zonedToUtc, formatDuration, dbDateToLocalDate, localDateToDbDate,
  formatDate, formatDateTime, formatLocalDate,
} from "./index";

const AR = DEFAULT_TZ;

describe("localDateOf / localTimeOf", () => {
  it("convierte UTC a fecha local de Argentina (UTC-3)", () => {
    const i = new Date("2026-11-02T01:30:00Z"); // domingo 1/11 22:30 en AR
    expect(localDateOf(i, AR)).toBe("2026-11-01");
    expect(localTimeOf(i, AR)).toBe("22:30");
  });
  it("respeta otra zona", () => {
    expect(localDateOf(new Date("2026-11-02T01:30:00Z"), "UTC")).toBe("2026-11-02");
  });
  it("medianoche local es 00:00, no 24:00", () => {
    expect(localTimeOf(new Date("2026-11-02T03:00:00Z"), AR)).toBe("00:00");
    expect(localDateOf(new Date("2026-11-02T03:00:00Z"), AR)).toBe("2026-11-02");
  });
});

describe("semanas (lunes a domingo)", () => {
  it("domingo 22:30 en AR pertenece a la semana que empezó el lunes anterior", () => {
    expect(weekKeyOf(new Date("2026-11-02T01:30:00Z"), AR)).toBe("2026-10-26");
  });
  it("lunes es su propia clave", () => {
    expect(weekKeyOfLocalDate("2026-10-26")).toBe("2026-10-26");
  });
  it("domingo pertenece a la semana del lunes anterior", () => {
    expect(weekKeyOfLocalDate("2026-11-01")).toBe("2026-10-26");
  });
  it("addDays / addWeeks cruzan meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });
  it("weekKeysBetween incluye la semana del inicio y la del fin", () => {
    expect(weekKeysBetween("2026-10-29", "2026-11-10")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
  });
  it("daysInWeekWithin cuenta días de la semana dentro del rango", () => {
    expect(daysInWeekWithin("2026-10-26", "2026-10-29", "2026-12-31")).toBe(4); // jue..dom
    expect(daysInWeekWithin("2026-11-02", "2026-10-29", "2026-11-03")).toBe(2); // lun, mar
    expect(daysInWeekWithin("2026-11-09", "2026-10-29", "2026-11-03")).toBe(0);
  });
});

describe("zonedToUtc", () => {
  it("hora local AR → UTC (+3h)", () => {
    expect(zonedToUtc("2026-10-30", "18:00", AR).toISOString()).toBe("2026-10-30T21:00:00.000Z");
  });
  it("maneja horario de verano (Madrid)", () => {
    expect(zonedToUtc("2026-07-01", "10:00", "Europe/Madrid").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "10:00", "Europe/Madrid").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
  it("ida y vuelta con localDateOf/localTimeOf", () => {
    const i = zonedToUtc("2026-11-01", "23:45", AR);
    expect(localDateOf(i, AR)).toBe("2026-11-01");
    expect(localTimeOf(i, AR)).toBe("23:45");
  });
});

describe("formatos", () => {
  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(70)).toBe("1 h 10 min");
  });
  it("formatDate usa la zona indicada (no la del servidor)", () => {
    expect(formatDate(new Date("2026-11-02T01:30:00Z"), AR, "short")).toBe("1 nov");
    expect(formatDate(new Date("2026-11-02T01:30:00Z"), "UTC", "short")).toBe("2 nov");
  });
  it("formatDate long incluye mes completo y año", () => {
    expect(formatDate(new Date("2026-11-02T01:30:00Z"), AR, "long")).toBe("1 de noviembre de 2026");
  });
  it("formatDateTime y formatLocalDate", () => {
    expect(formatDateTime(new Date("2026-11-02T01:30:00Z"), AR)).toBe("1 nov, 22:30");
    expect(formatLocalDate("2026-11-01")).toBe("1 nov");
  });
  it("columnas @db.Date ida y vuelta", () => {
    expect(dbDateToLocalDate(localDateToDbDate("2026-10-01"))).toBe("2026-10-01");
  });
});
