import { describe, expect, it, vi } from "vitest";
import { makeCustomer, makeTenant } from "../../tests/helpers";

vi.mock("./finance", () => ({ onQuoteApproved: vi.fn(), onQuoteCanceled: vi.fn(), createReceivable: vi.fn(), registerPayment: vi.fn() }));
import { approveQuote, saveQuote, type QuoteInput } from "./quotes";
import { quoteTotals, suggestPrices } from "./line-items";

const base = (customerId: string, over: Partial<QuoteInput> = {}): QuoteInput => ({
  customerId, discount: "0", extraFee: "0", uberMode: "INCLUDED", uberCost: "0", uberMarkup: false,
  items: [{ kind: "PART", description: "SSD", quantity: "2", unitCost: "100.00", unitPrice: "150.00" }, { kind: "LABOR", description: "Formatar", quantity: "1", unitCost: "20", unitPrice: "80" }],
  ...over,
});

describe("quote math", () => {
  const r = { marginPct: "40", taxPct: "6", cardFeePct: "4" };
  it("INCLUDED/ABSORBED add no line; SEPARATE does; cost counts uber once", () => {
    const items = base("x").items;
    const u = (uberMode: "INCLUDED" | "SEPARATE" | "ABSORBED") => quoteTotals(items, { uberMode, uberCost: "10", uberMarkup: false }, r, "5", "2");
    expect(u("INCLUDED").totalAmount.toFixed(2)).toBe("377.00"); // 380 - 5 + 2
    expect(u("ABSORBED").totalAmount.toFixed(2)).toBe("377.00");
    expect(u("SEPARATE").totalAmount.toFixed(2)).toBe("388.11"); // 10 / (1 - 0.10) = 11.11 passes through
    for (const m of ["INCLUDED", "SEPARATE", "ABSORBED"] as const) expect(u(m).totalCost.toFixed(2)).toBe("230.00");
  });
  it("suggests prices from cost via calculatePrice", () => {
    const [part] = suggestPrices(base("x").items, { partMarginPct: "40", laborMarginPct: "50", taxPct: "6", cardFeePct: "4" }, { uberMode: "INCLUDED", uberCost: "0", uberMarkup: false });
    expect(part.unitPrice).toBe("200.00"); // group cost 200 / (1 - 0.5) = 400, spread over 2 units
  });
});

describe("quotes", () => {
  it("numbers unique per tenant under concurrency", async () => {
    const t = await makeTenant("Q"); const c = await makeCustomer(t.db);
    const qs = await Promise.all(Array.from({ length: 6 }, () => saveQuote(t.db, t.tenantId, null, base(c.id))));
    expect(new Set(qs.map((x) => x.quote.number)).size).toBe(6);
  });

  it("approved quote is a snapshot: editing creates revision 2 and cancels the parent; items untouched", async () => {
    const t = await makeTenant("R"); const c = await makeCustomer(t.db);
    const { quote: q1 } = await saveQuote(t.db, t.tenantId, null, base(c.id));
    expect(q1.totalAmount.toString()).toBe("380");
    await approveQuote(t.db, q1.id, "WhatsApp");
    const { quote: q2, revised } = await saveQuote(t.db, t.tenantId, q1.id, base(c.id, { items: [{ kind: "PART", description: "RAM", quantity: "1", unitCost: "10", unitPrice: "50" }] }));
    expect(revised).toBe(true);
    expect([q2.number, q2.revision, q2.parentQuoteId]).toEqual([q1.number, 2, q1.id]);
    const old = await t.db.quote.findFirstOrThrow({ where: { id: q1.id }, include: { items: true } });
    expect(old.status).toBe("CANCELED");
    expect(old.totalAmount.toString()).toBe("380");
    expect(old.items).toHaveLength(2);
    expect(old.approvalMethod).toBe("WhatsApp");
  });
});
