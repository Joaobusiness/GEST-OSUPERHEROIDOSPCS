import Decimal from "decimal.js";
import type { PricingInput } from "@/lib/pricing";

/** Calculator state as typed by the user; every value is a string so no float ever touches money. */
export type SimInput = { partCost: string; laborCost: string; uberOn: boolean; uberCost: string; markupPct: string };

/** "1.234,56" or "1234.56" to "1234.56". Returns null when it is not a number. */
export function dec(s: string): string | null {
  const t = s.trim();
  if (t === "") return "0";
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d+)?$/.test(n) ? n : null;
}

/** Builds the engine input; the first invalid field name is returned as an error. Uber "Não" always contributes 0. */
export function toPricingInput(s: SimInput): { input: PricingInput } | { error: string } {
  const f: Record<string, string | null> = { partCost: dec(s.partCost), laborCost: dec(s.laborCost), uberCost: s.uberOn ? dec(s.uberCost) : "0", markupPct: dec(s.markupPct) };
  for (const [k, v] of Object.entries(f)) if (v === null) return { error: `Valor inválido em ${LABELS[k]}.` };
  // Uber "Sim": the amount typed is charged as its own line, on top of the marked-up price
  return { input: { partCost: f.partCost!, laborCost: f.laborCost!, uberCost: f.uberCost!, uberMode: "SEPARATE", markupPct: f.markupPct! } };
}

const LABELS: Record<string, string> = { partCost: "custo da peça", laborCost: "custo da mão de obra", uberCost: "valor do Uber", markupPct: "margem de lucro" };

/**
 * Simulation saved in the history, back into the calculator. Accounts saved before the markup change stored
 * `marginPct` (margin on selling price): it is converted to the markup that gives the same price, never reread as markup.
 */
export function fromSaved(input: Record<string, unknown>, defaults: SimInput): SimInput {
  const str = (k: string, d: string) => (typeof input[k] === "string" ? (input[k] as string) : d);
  const base = { ...defaults, partCost: str("partCost", ""), laborCost: str("laborCost", ""), uberCost: str("uberCost", "0") };
  if (typeof input.markupPct === "string") return { ...base, uberOn: input.uberOn === true, markupPct: input.markupPct };
  const m = dec(str("marginPct", "")), uber = dec(base.uberCost);
  return {
    ...base, uberOn: uber !== null && Number(uber) > 0,
    markupPct: m !== null && Number(m) < 100 ? new Decimal(m).div(new Decimal(100).minus(m)).times(100).toDecimalPlaces(2).toString() : defaults.markupPct,
  };
}
