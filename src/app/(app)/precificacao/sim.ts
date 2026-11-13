import type { PricingInput, UberMode } from "@/lib/pricing";

/** Calculator state as typed by the user; every value is a string so no float ever touches money. */
export type SimInput = {
  partCost: string; laborCost: string; laborPrice: string; uberCost: string; uberMode: UberMode; uberMarkup: boolean;
  otherCosts: string; fixedFees: string; marginPct: string; taxPct: string; cardFeePct: string; manualPrice: string;
};

/** "1.234,56" or "1234.56" to "1234.56". Returns null when it is not a number. */
export function dec(s: string): string | null {
  const t = s.trim();
  if (t === "") return "0";
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d+)?$/.test(n) ? n : null;
}

/** Builds the engine input; the first invalid field name is returned as an error. */
export function toPricingInput(s: SimInput): { input: PricingInput } | { error: string } {
  const f: Record<string, string | null> = {};
  for (const k of ["partCost", "laborCost", "uberCost", "otherCosts", "fixedFees", "marginPct", "taxPct", "cardFeePct"] as const) f[k] = dec(s[k]);
  for (const [k, v] of Object.entries(f)) if (v === null) return { error: `Valor inválido em ${LABELS[k]}.` };
  const optionalDec = (v: string) => (v.trim() === "" ? null : dec(v));
  const laborPrice = optionalDec(s.laborPrice);
  const manualPrice = optionalDec(s.manualPrice);
  if (s.laborPrice.trim() !== "" && laborPrice === null) return { error: "Valor inválido em preço desejado da mão de obra." };
  if (s.manualPrice.trim() !== "" && manualPrice === null) return { error: "Valor inválido em preço manual." };
  return {
    input: {
      partCost: f.partCost!, laborCost: f.laborCost!, laborPrice, uberCost: f.uberCost!, uberMode: s.uberMode,
      uberMarkup: s.uberMarkup, otherCosts: f.otherCosts!, fixedFees: f.fixedFees!, marginPct: f.marginPct!,
      taxPct: f.taxPct!, cardFeePct: f.cardFeePct!, manualPrice,
    },
  };
}

const LABELS: Record<string, string> = {
  partCost: "custo da peça", laborCost: "custo da mão de obra", uberCost: "custo do Uber", otherCosts: "outros custos",
  fixedFees: "taxas fixas", marginPct: "margem", taxPct: "imposto", cardFeePct: "taxa do cartão",
};
