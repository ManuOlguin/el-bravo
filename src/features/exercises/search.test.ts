import { describe, it, expect } from "vitest";
import { searchExercises, normalize, levenshteinWithin1, type CatalogEntry } from "./search";

const e = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name, name, nameEn: null, measureType: "reps", equipment: "other", tracksWeight: true, primaryGroupKey: null, mediaUrl: null,
  aliases: [], groupKeys: [], isMine: false, ...o,
});
const catalog = [
  e("Press banca", { nameEn: "Bench Press", aliases: ["pecho plano", "press de banca"], equipment: "barbell", groupKeys: ["chest", "arms"] }),
  e("Extensión de tríceps en polea", { nameEn: "Triceps Pushdown", aliases: ["triceps polea"], equipment: "cable", groupKeys: ["arms"] }),
  e("Jalón al pecho", { nameEn: "Lat Pulldown", equipment: "machine", groupKeys: ["back"] }),
  e("Sentadilla", { nameEn: "Squat", aliases: ["squat"], equipment: "barbell", groupKeys: ["legs"] }),
  e("Plancha", { nameEn: "Plank", measureType: "duration", equipment: "bodyweight", groupKeys: ["core"] }),
];

describe("normalize", () => {
  it("quita acentos, mayúsculas y signos", () => expect(normalize("  Jalón  al PECHO! ")).toBe("jalon al pecho"));
  it("ñ → n y guiones como espacio", () => expect(normalize("Año-Nuevo")).toBe("ano nuevo"));
});

describe("levenshteinWithin1", () => {
  it("detecta 0 o 1 edición", () => {
    expect(levenshteinWithin1("sentadila", "sentadilla")).toBe(true);
    expect(levenshteinWithin1("press", "prese")).toBe(true);
    expect(levenshteinWithin1("press", "press")).toBe(true);
    expect(levenshteinWithin1("bench", "banca")).toBe(false);
    expect(levenshteinWithin1("ab", "abcd")).toBe(false);
  });
});

describe("searchExercises", () => {
  const names = (q: string, f?: Parameters<typeof searchExercises>[2]) => searchExercises(catalog, q, f).map((x) => x.name);
  it("ignora acentos", () => expect(names("jalon")).toEqual(["Jalón al pecho"]));
  it("encuentra por nombre en inglés y por alias", () => {
    expect(names("bench")).toEqual(["Press banca"]);
    expect(names("pushdown")).toEqual(["Extensión de tríceps en polea"]);
    expect(names("squat")).toEqual(["Sentadilla"]);
  });
  it("palabras en cualquier orden", () => expect(names("banca press")).toEqual(["Press banca"]));
  it("tolera un error de tipeo", () => expect(names("sentadila")).toEqual(["Sentadilla"]));
  it("tolera un error mientras se tipea (prefijo)", () => expect(names("sentsdi")).toEqual(["Sentadilla"]));
  it("palabras cortas no admiten error", () => {
    expect(names("ple")).toEqual([]);
    expect(names("sqat")).toEqual(["Sentadilla"]);
  });
  it("prioriza prefijo de nombre sobre alias", () => {
    const c = [...catalog, e("Pecho en máquina", { groupKeys: ["chest"] })];
    expect(searchExercises(c, "pecho").map((x) => x.name)[0]).toBe("Pecho en máquina");
  });
  it("ranking completo: exacto > prefijo nombre > prefijo alias > palabras", () => {
    const c = [...catalog, e("Pecho"), e("Pecho en máquina")];
    expect(searchExercises(c, "pecho").map((x) => x.name)).toEqual(["Pecho", "Pecho en máquina", "Press banca", "Jalón al pecho"]);
  });
  it("filtra por grupo muscular y equipamiento", () => {
    expect(names("", { groupKey: "arms" })).toEqual(["Extensión de tríceps en polea", "Press banca"]);
    expect(names("", { equipment: "barbell" })).toEqual(["Press banca", "Sentadilla"]);
    expect(names("", { groupKey: "legs", equipment: "barbell" })).toEqual(["Sentadilla"]);
  });
  it("query vacía devuelve todo en orden alfabético", () =>
    expect(names("   ")).toEqual(["Extensión de tríceps en polea", "Jalón al pecho", "Plancha", "Press banca", "Sentadilla"]));
  it("los propios primero", () => {
    const c = [...catalog, e("Press banca inclinado (mío)", { isMine: true })];
    expect(searchExercises(c, "press").map((x) => x.name)[0]).toBe("Press banca inclinado (mío)");
  });
  it("sin resultados", () => expect(names("zzzz")).toEqual([]));
});
