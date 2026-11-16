import { describe, expect, it } from "vitest";
import { quoteTotals, type Line } from "@/server/line-items";
import { clearDraft, draftKey, restoreDraft, saveDraft, type QuoteDraftData } from "./draft";

/** In-memory stand-in for localStorage: it outlives the "screens" below the way the real one outlives navigation and refresh. */
function memory() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

const ssd: Line = { kind: "PART", description: "SSD 480 GB", quantity: "1", unitCost: "218", unitPrice: "348.80" };
const data = (over: Partial<QuoteDraftData> = {}): QuoteDraftData => ({
  customerId: "c1", services: [{ kind: "LABOR", description: "Formatação", quantity: "1", unitCost: "0", unitPrice: "120" }], products: [ssd],
  discount: "10", uberOn: true, uberCost: "30", notes: "Troca do SSD", validUntil: "2026-12-01", executionDays: "2", paymentTerms: "Pix", warranty: "90 dias", ...over,
});
const key = draftKey("t1", "u1");

describe("quote draft", () => {
  it("survives leaving for another module: every field, option and product comes back exactly", () => {
    const store = memory();
    saveDraft(store, key, "", "", data());
    // user opens Financeiro, comes back: a brand-new form instance reads the same storage
    expect(restoreDraft(store, key, "", "", {})?.data).toEqual(data());
  });

  it("is restored after a page refresh or a killed tab, with the same totals (nothing stale)", () => {
    const store = memory();
    saveDraft(store, key, "", "", data());
    const again = restoreDraft(store, key, "", "", {})!.data;
    const total = (d: QuoteDraftData) => quoteTotals([...d.services, ...d.products], { uberMode: "SEPARATE", uberCost: d.uberOn ? d.uberCost : "0", uberMarkup: false }, { marginPct: "60", taxPct: "0", cardFeePct: "0" }, d.discount, "0");
    expect(total(again).totalAmount.toFixed(2)).toBe("488.80"); // 120 + 348.80 + 30 - 10
    expect(total(again).totalAmount.toFixed(2)).toBe(total(data()).totalAmount.toFixed(2));
  });

  it("the last write wins: no duplicated lines after many autosaves", () => {
    const store = memory();
    for (let i = 0; i < 20; i++) saveDraft(store, key, "", "", data({ notes: `v${i}` }));
    const r = restoreDraft(store, key, "", "", {})!.data;
    expect(r.notes).toBe("v19");
    expect(r.products).toHaveLength(1);
    expect(store.m.size).toBe(1);
  });

  it("calculator result is added once: refresh or Back on the same URL never duplicates it", () => {
    const store = memory();
    const seeded = { items: [{ kind: "OTHER", description: "Serviço", quantity: "1", unitCost: "100", unitPrice: "160" } as Line], uberCost: "25.00" };
    saveDraft(store, key, "", "", data({ uberOn: false, uberCost: "0" }));
    const first = restoreDraft(store, key, "", "custo=100&preco=160", seeded)!;
    expect(first.data.services).toHaveLength(2);
    expect(first.data.uberOn).toBe(true);
    expect(first.data.uberCost).toBe("25.00");
    saveDraft(store, key, "", first.seed, first.data);
    expect(restoreDraft(store, key, "", "custo=100&preco=160", seeded)!.data.services).toHaveLength(2);
  });

  it("a draft made against an older version of a saved quote is stale and is dropped", () => {
    const store = memory();
    const k = draftKey("t1", "u1", "q1");
    saveDraft(store, k, "2026-11-16T10:00:00.000Z", "", data());
    expect(restoreDraft(store, k, "2026-11-16T10:00:00.000Z", "", {})?.data.notes).toBe("Troca do SSD");
    expect(restoreDraft(store, k, "2026-11-16T12:30:00.000Z", "", {})).toBeNull(); // quote was saved since
    expect(store.m.has(k)).toBe(false);
  });

  it("drafts are separate per company, user and quote", () => {
    const store = memory();
    saveDraft(store, key, "", "", data());
    expect(restoreDraft(store, draftKey("t1", "u2"), "", "", {})).toBeNull();
    expect(restoreDraft(store, draftKey("t2", "u1"), "", "", {})).toBeNull();
    expect(restoreDraft(store, draftKey("t1", "u1", "q1"), "", "", {})).toBeNull();
  });

  it("is cleared only on purpose (save completed or discard) and tolerates broken storage", () => {
    const store = memory();
    saveDraft(store, key, "", "", data());
    clearDraft(store, key);
    expect(restoreDraft(store, key, "", "", {})).toBeNull();
    store.m.set(key, "{not json");
    expect(restoreDraft(store, key, "", "", {})).toBeNull();
    expect(restoreDraft(null, key, "", "", {})).toBeNull();
    expect(() => saveDraft({ ...store, setItem: () => { throw new Error("QuotaExceeded"); } }, key, "", "", data())).not.toThrow();
  });
});
