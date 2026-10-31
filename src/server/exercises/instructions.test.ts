import { describe, it, expect } from "vitest";
import { parseInstructions } from "./instructions";

describe("parseInstructions", () => {
  it("lee { steps, reviewed }", () =>
    expect(parseInstructions({ steps: ["a", "b"], reviewed: true })).toEqual({ steps: ["a", "b"], reviewed: true }));
  it("acepta el formato viejo string[] como no revisado", () =>
    expect(parseInstructions(["a", "", 3, "b"])).toEqual({ steps: ["a", "b"], reviewed: false }));
  it("null o basura → sin pasos", () => {
    expect(parseInstructions(null)).toEqual({ steps: [], reviewed: false });
    expect(parseInstructions("x")).toEqual({ steps: [], reviewed: false });
    expect(parseInstructions({ steps: "x", reviewed: "yes" })).toEqual({ steps: [], reviewed: false });
  });
});
