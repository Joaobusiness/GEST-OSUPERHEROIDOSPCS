import { describe, expect, it } from "vitest";
import { approveQuote, cancelQuote, saveQuote, type QuoteInput } from "@/server/quotes";
import { registerPayment } from "@/server/finance";
import { makeCustomer, makeTenant } from "./helpers";

const input = (customerId: string, over: Partial<QuoteInput> = {}): QuoteInput => ({
  customerId, discount: "0", extraFee: "0", uberMode: "SEPARATE", uberCost: "30", uberMarkup: false,
  items: [{ kind: "PART", description: "SSD", quantity: "1", unitCost: "150", unitPrice: "300" }],
  ...over,
});

const live = (db: Awaited<ReturnType<typeof makeTenant>>["db"], type: "INCOME" | "EXPENSE") =>
  db.financialTransaction.findMany({ where: { type, status: { not: "CANCELED" } } });

describe("quote -> finance (real, no mocks)", () => {
  it("approving books income once and the uber cost once, even on repeated approve", async () => {
    const t = await makeTenant("QF"); const c = await makeCustomer(t.db);
    const { quote } = await saveQuote(t.db, t.tenantId, null, input(c.id));
    await approveQuote(t.db, quote.id, "WhatsApp");
    await approveQuote(t.db, quote.id, "WhatsApp").catch(() => {}); // already decided
    expect(await live(t.db, "EXPENSE")).toHaveLength(1);
    const income = await live(t.db, "INCOME");
    const sum = income.reduce((a, r) => a + Number(r.amount), 0);
    expect(sum).toBeCloseTo(Number(quote.totalAmount), 2);
  });

  it("revising an approved quote cancels what the parent booked: no double revenue or double uber", async () => {
    const t = await makeTenant("QF2"); const c = await makeCustomer(t.db);
    const { quote: q1 } = await saveQuote(t.db, t.tenantId, null, input(c.id));
    await approveQuote(t.db, q1.id, "presencial");
    const { quote: q2 } = await saveQuote(t.db, t.tenantId, q1.id, input(c.id, { discount: "50" }));
    await approveQuote(t.db, q2.id, "presencial");

    expect(await live(t.db, "EXPENSE")).toHaveLength(1);
    const sum = (await live(t.db, "INCOME")).reduce((a, r) => a + Number(r.amount), 0);
    expect(sum).toBeCloseTo(Number(q2.totalAmount), 2);
  });

  it("canceling an approved quote with a partial payment reverses it and keeps history", async () => {
    const t = await makeTenant("QF3"); const c = await makeCustomer(t.db);
    const { quote } = await saveQuote(t.db, t.tenantId, null, input(c.id, { uberMode: "ABSORBED" }));
    await approveQuote(t.db, quote.id, "manual");
    const [main] = await live(t.db, "INCOME");
    await registerPayment(t.db, main.id, { amount: "100.00", method: "Pix" });
    await cancelQuote(t.db, quote.id);

    expect(await live(t.db, "INCOME")).toHaveLength(0);
    const pays = await t.db.transactionPayment.findMany({ where: { transactionId: main.id } });
    expect(pays.reduce((a, p) => a + Number(p.amount), 0)).toBe(0); // paid 100, reversed -100
    expect(pays).toHaveLength(2); // history preserved
  });

  it("ABSORBED uber: cost booked, no repasse revenue", async () => {
    const t = await makeTenant("QF4"); const c = await makeCustomer(t.db);
    const { quote } = await saveQuote(t.db, t.tenantId, null, input(c.id, { uberMode: "ABSORBED" }));
    await approveQuote(t.db, quote.id, "manual");
    expect(await live(t.db, "EXPENSE")).toHaveLength(1);
    const income = await live(t.db, "INCOME");
    expect(income).toHaveLength(1);
    expect(Number(income[0].amount)).toBeCloseTo(Number(quote.totalAmount), 2);
  });
});
