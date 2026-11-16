import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePrice, legacyPriceFromMargin, priceFromMarkup, PricingError } from "./pricing";
import { markupOf, markupPrice, quoteTotals, uberCharge, type Line } from "@/server/line-items";
import { fromSaved, toPricingInput, type SimInput } from "@/app/(app)/precificacao/sim";

const base = { partCost: 200, laborCost: 100, otherCosts: 20, markupPct: 40 };

describe("markup over cost (regression: was margin on selling price)", () => {
  it("R$ 218,00 at 60% markup, no Uber => R$ 348,80, gross profit R$ 130,80", () => {
    const r = calculatePrice({ partCost: "218.00", markupPct: 60 });
    expect(r.suggestedPrice).toBe("348.80");
    expect(r.finalPrice).toBe("348.80");
    expect(r.profit).toBe("130.80");
    expect(r.totalCost).toBe("218.00");
    expect(r.uberCharge).toBe("0.00");
  });

  it("never returns the old margin result (218 / 0.4 = 545)", () => {
    expect(calculatePrice({ partCost: 218, markupPct: 60 }).finalPrice).not.toBe("545.00");
    expect(priceFromMarkup(new Decimal(218), new Decimal(60)).toFixed(2)).toBe("348.80");
  });

  it("markup can pass 100% (the margin formula threw there)", () => {
    expect(calculatePrice({ partCost: 100, markupPct: 150 }).finalPrice).toBe("250.00");
  });

  it("every pricing flow agrees: engine, quote line, calculator", () => {
    const calc = toPricingInput({ partCost: "218,00", laborCost: "", uberOn: false, uberCost: "0", markupPct: "60" });
    if ("error" in calc) throw new Error(calc.error);
    expect(calculatePrice(calc.input).finalPrice).toBe("348.80");
    expect(markupPrice("218,00", "60")).toBe("348.80");
    expect(markupOf("218", "348.80")).toBe("60");
  });

  it("no binary float drift", () => {
    expect(calculatePrice({ partCost: "0.1", laborCost: "0.2", markupPct: 0 }).totalCost).toBe("0.30");
  });

  it("% fees on the selling price gross the price up and must stay under 100%", () => {
    expect(calculatePrice({ partCost: 90, markupPct: 0, taxPct: 6, cardFeePct: 4 }).suggestedPrice).toBe("100.00");
    expect(() => calculatePrice({ ...base, taxPct: 60, cardFeePct: 40 })).toThrow(PricingError);
  });

  it("manual price recomputes profit", () => {
    expect(calculatePrice({ ...base, manualPrice: 500 }).profit).toBe("180.00");
  });
});

describe("Uber Sim / Não", () => {
  const sim = (over: Partial<SimInput>): SimInput => ({ partCost: "218", laborCost: "", uberOn: false, uberCost: "0", markupPct: "60", ...over });
  const run = (s: SimInput) => { const b = toPricingInput(s); if ("error" in b) throw new Error(b.error); return calculatePrice(b.input); };

  it("Não always contributes R$ 0,00, even with an amount left in the field", () => {
    const r = run(sim({ uberOn: false, uberCost: "35" }));
    expect(r.uberCharge).toBe("0.00");
    expect(r.logisticsCost).toBe("0.00");
    expect(r.finalPrice).toBe("348.80");
    expect(r.profit).toBe("130.80");
  });

  it("Sim charges the amount typed on top of the marked-up price, with no markup on it", () => {
    const r = run(sim({ uberOn: true, uberCost: "30" }));
    expect(r.suggestedPrice).toBe("348.80");
    expect(r.uberCharge).toBe("30.00");
    expect(r.finalPrice).toBe("378.80");
    expect(r.totalCost).toBe("248.00");
    expect(r.profit).toBe("130.80"); // pass-through: the customer only repays the ride
  });

  it("switching Sim -> Não -> Sim moves the total right away and consistently", () => {
    const on = run(sim({ uberOn: true, uberCost: "30" })).finalPrice;
    const off = run(sim({ uberOn: false, uberCost: "0" })).finalPrice;
    expect([on, off, run(sim({ uberOn: true, uberCost: "30" })).finalPrice]).toEqual(["378.80", "348.80", "378.80"]);
  });

  it("quote total: Sim adds the Uber line and its cost once, Não adds nothing", () => {
    const items: Line[] = [{ kind: "PART", description: "SSD", quantity: "1", unitCost: "218", unitPrice: markupPrice("218", "60") }];
    const rates = { marginPct: "60", taxPct: "0", cardFeePct: "0" };
    const on = quoteTotals(items, { uberMode: "SEPARATE", uberCost: "30", uberMarkup: false }, rates, "0", "0");
    const off = quoteTotals(items, { uberMode: "SEPARATE", uberCost: "0", uberMarkup: false }, rates, "0", "0");
    expect(on.totalAmount.toFixed(2)).toBe("378.80");
    expect(on.totalCost.toFixed(2)).toBe("248.00");
    expect(off.totalAmount.toFixed(2)).toBe("348.80");
    expect(off.totalAmount.minus(off.totalCost).toFixed(2)).toBe("130.80");
    expect(off.uberCharge.toFixed(2)).toBe("0.00");
  });
});

describe("history is not reinterpreted", () => {
  it("legacy quote with profit on the Uber line keeps the margin formula it was saved with", () => {
    // saved before the change: SEPARATE + uberMarkup at 40% margin => 30 / 0.6 = 50.00
    expect(uberCharge({ uberMode: "SEPARATE", uberCost: "30", uberMarkup: true }, { marginPct: "40", taxPct: "0", cardFeePct: "0" }).toFixed(2)).toBe("50.00");
    expect(legacyPriceFromMargin(new Decimal(30), new Decimal(40), new Decimal(0)).toFixed(2)).toBe("50.00");
  });

  it("legacy INCLUDED / ABSORBED quotes still add no Uber line and count the cost once", () => {
    const items: Line[] = [{ kind: "PART", description: "x", quantity: "1", unitCost: "100", unitPrice: "200" }];
    for (const uberMode of ["INCLUDED", "ABSORBED"] as const) {
      const t = quoteTotals(items, { uberMode, uberCost: "30", uberMarkup: false }, { marginPct: "40", taxPct: "0", cardFeePct: "0" }, "0", "0");
      expect(t.totalAmount.toFixed(2)).toBe("200.00");
      expect(t.totalCost.toFixed(2)).toBe("130.00");
    }
  });

  it("a simulation saved with margin reopens with the markup that gives the same price", () => {
    const defaults: SimInput = { partCost: "", laborCost: "", uberOn: false, uberCost: "0", markupPct: "60" };
    const s = fromSaved({ partCost: "300", laborCost: "", uberCost: "0", uberMode: "INCLUDED", marginPct: "40" }, defaults);
    expect(s.markupPct).toBe("66.67"); // 300 / 0.6 = 500 before; 300 * 1.6667 = 500.01 now
    expect(s.uberOn).toBe(false);
    const b = toPricingInput(s); if ("error" in b) throw new Error(b.error);
    expect(Number(calculatePrice(b.input).finalPrice)).toBeCloseTo(500, 1);
    // a new-format simulation is read as is
    expect(fromSaved({ partCost: "218", laborCost: "", uberOn: true, uberCost: "30", markupPct: "60" }, defaults)).toEqual({ partCost: "218", laborCost: "", uberOn: true, uberCost: "30", markupPct: "60" });
  });
});
