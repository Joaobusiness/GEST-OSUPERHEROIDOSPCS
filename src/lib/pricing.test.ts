import { describe, expect, it } from "vitest";
import { calculatePrice, PricingError } from "./pricing";

const base = { partCost: 200, laborCost: 100, otherCosts: 20, marginPct: 40 };

describe("calculatePrice", () => {
  it("briefing example: cost 350 at 40% => 583.33, profit 233.33", () => {
    const r = calculatePrice({ ...base, uberCost: 30, uberMode: "INCLUDED" });
    expect(r.totalCost).toBe("350.00");
    expect(r.suggestedPrice).toBe("583.33");
    expect(r.profit).toBe("233.33");
    expect(r.effectiveMarginPct).toBe("40.00");
  });

  it("taxes and card fee go into the denominator, margin stays effective", () => {
    const r = calculatePrice({ ...base, uberCost: 30, taxPct: 6, cardFeePct: 4 });
    expect(r.suggestedPrice).toBe("700.00"); // 350 / (1 - 0.5)
    expect(r.effectiveMarginPct).toBe("40.00");
  });

  it("SEPARATE pass-through: price excludes uber, customer pays it as its own line", () => {
    const r = calculatePrice({ ...base, uberCost: 30, uberMode: "SEPARATE" });
    expect(r.suggestedPrice).toBe("533.33"); // 320 / 0.6
    expect(r.uberCharge).toBe("30.00");
    expect(r.finalPrice).toBe("563.33");
  });

  it("ABSORBED: uber is a cost, not charged, profit drops", () => {
    const inc = calculatePrice({ ...base, uberCost: 30, uberMode: "INCLUDED" });
    const abs = calculatePrice({ ...base, uberCost: 30, uberMode: "ABSORBED" });
    expect(abs.uberCharge).toBe("0.00");
    expect(abs.totalCost).toBe("350.00");
    expect(Number(abs.profit)).toBeLessThan(Number(inc.profit));
  });

  it("uber cost is counted once in every mode", () => {
    for (const uberMode of ["INCLUDED", "SEPARATE", "ABSORBED"] as const) {
      expect(calculatePrice({ ...base, uberCost: 30, uberMode }).totalCost).toBe("350.00");
    }
  });

  it("rejects denominator <= 0", () => {
    expect(() => calculatePrice({ ...base, marginPct: 90, taxPct: 6, cardFeePct: 4 })).toThrow(PricingError);
  });

  it("manual price recomputes effective margin", () => {
    const r = calculatePrice({ ...base, manualPrice: 500 });
    expect(r.profit).toBe("180.00");
    expect(r.effectiveMarginPct).toBe("36.00");
  });

  it("no binary float drift", () => {
    const r = calculatePrice({ partCost: "0.1", laborCost: "0.2", marginPct: 0 });
    expect(r.totalCost).toBe("0.30");
  });
});
