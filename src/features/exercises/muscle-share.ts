/** Lógica pura del `MuscleShareEditor`: porcentajes por músculo que suman 100. */

export const SHARE_STEP = 5;

export const sumShare = (values: number[]) => values.reduce((s, v) => s + v, 0);

export function isValidShare(values: number[]): boolean {
  return values.length > 0 && values.every((v) => Number.isInteger(v) && v >= 1 && v <= 100) && sumShare(values) === 100;
}

/** Reparte 100 en `n` partes lo más iguales posible, en múltiplos de `step` (los primeros reciben el resto). */
export function splitEvenly(n: number, step = SHARE_STEP): number[] {
  if (n <= 0) return [];
  const unit = n > 100 / step ? 1 : step; // con muchos músculos no alcanza el paso de 5
  const units = 100 / unit;
  const base = Math.floor(units / n);
  const rem = units % n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) * unit);
}

/**
 * Escala proporcionalmente para que sume 100, redondeando a `step` con el método del mayor resto.
 * Ningún músculo queda en 0 (se le saca un paso al mayor).
 */
export function normalizeTo100(values: number[], step = SHARE_STEP): number[] {
  const n = values.length;
  if (n === 0) return [];
  const total = sumShare(values.map((v) => Math.max(0, v)));
  if (total <= 0) return splitEvenly(n, step);
  const unit = n > 100 / step ? 1 : step;
  const units = 100 / unit;
  const exact = values.map((v) => (Math.max(0, v) / total) * units);
  const out = exact.map(Math.floor);
  let left = units - sumShare(out);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i]++;
  for (let i = 0; i < n; i++) {
    if (out[i] === 0) {
      const max = out.indexOf(Math.max(...out));
      out[max]--;
      out[i] = 1;
    }
  }
  return out.map((u) => u * unit);
}
