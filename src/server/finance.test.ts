import { describe, expect, it } from "vitest";
import { makeCustomer, makeTenant } from "../../tests/helpers";
import { cancelTransaction, createReceivable, onOrderDelivered, onQuoteApproved, registerPayment, cashSummary, resolvePeriod } from "./finance";

const due = new Date("2026-05-10T00:00:00Z");

async function receivable(amount: string, key = Math.random().toString()) {
  const { db } = await makeTenant("fin");
  const c = await makeCustomer(db);
  const t = await createReceivable(db, { customerId: c.id, amount, description: "x", dueDate: due, allocationKey: key });
  return { db, c, t };
}

async function quote(db: Awaited<ReturnType<typeof makeTenant>>["db"], customerId: string, mode: string, total: string, uber = "20") {
  return db.quote.create({
    data: { customerId, number: String(Math.random()), status: "APPROVED", uberMode: mode, uberCost: uber, totalAmount: total, marginPct: "0", taxPct: "0", cardFeePct: "0" } as never,
  });
}

describe("registerPayment", () => {
  it("partial payments end PAID, overpayment is rejected", async () => {
    const { db, t } = await receivable("100.00");
    expect((await registerPayment(db, t.id, { amount: "40" })).status).toBe("PENDING");
    await expect(registerPayment(db, t.id, { amount: "60.01" })).rejects.toThrow(/saldo/);
    const paid = await registerPayment(db, t.id, { amount: "60.00", method: "PIX" });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    await expect(registerPayment(db, t.id, { amount: "1" })).rejects.toThrow(/quitado/);
  });

  it("concurrent payments never exceed the amount", async () => {
    const { db, t } = await receivable("100.00");
    const r = await Promise.allSettled([registerPayment(db, t.id, { amount: "60" }), registerPayment(db, t.id, { amount: "60" }), registerPayment(db, t.id, { amount: "60" })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const sum = await db.transactionPayment.aggregate({ where: { transactionId: t.id }, _sum: { amount: true } });
    expect(sum._sum.amount?.toString()).toBe("60");
  });

  it("canceled keeps history, reverses cash and rejects payment", async () => {
    const { db, t } = await receivable("100.00");
    await registerPayment(db, t.id, { amount: "30" });
    await cancelTransaction(db, t.id);
    expect((await db.transactionPayment.count({ where: { transactionId: t.id } }))).toBe(2);
    await expect(registerPayment(db, t.id, { amount: "10" })).rejects.toThrow(/cancelado/);
    const s = await cashSummary(db, resolvePeriod({ p: "custom", de: "2020-01-01", ate: "2099-12-31" }));
    expect(s.received.toFixed(2)).toBe("0.00");
  });

  it("pending is not counted as received", async () => {
    const { db, t } = await receivable("100.00");
    await registerPayment(db, t.id, { amount: "25" });
    const s = await cashSummary(db, resolvePeriod({ p: "custom", de: "2020-01-01", ate: "2099-12-31" }));
    expect(s.received.toFixed(2)).toBe("25.00");
    expect(s.toReceive.total.toFixed(2)).toBe("75.00");
  });
});

describe("onQuoteApproved", () => {
  const rows = (db: Awaited<ReturnType<typeof makeTenant>>["db"]) =>
    db.financialTransaction.findMany({ select: { type: true, amount: true, allocationKey: true } });
  const find = (r: Awaited<ReturnType<typeof rows>>, suffix: string) => r.find((x) => x.allocationKey?.endsWith(suffix));

  it("INCLUDED: one revenue, one uber cost, idempotent", async () => {
    const { db } = await makeTenant("q1");
    const q = await quote(db, (await makeCustomer(db)).id, "INCLUDED", "200");
    await onQuoteApproved(db, q.id);
    await onQuoteApproved(db, q.id);
    const r = await rows(db);
    expect(r).toHaveLength(2);
    expect(find(r, ":main")?.amount.toString()).toBe("200");
    expect(find(r, ":uber-cost")).toMatchObject({ type: "EXPENSE" });
    expect(find(r, ":uber-income")).toBeUndefined();
  });

  it("SEPARATE: main excludes the uber line, uber income and cost booked once", async () => {
    const { db } = await makeTenant("q2");
    const q = await quote(db, (await makeCustomer(db)).id, "SEPARATE", "220");
    await Promise.all([onQuoteApproved(db, q.id), onQuoteApproved(db, q.id)]);
    const r = await rows(db);
    expect(r).toHaveLength(3);
    expect(find(r, ":main")?.amount.toString()).toBe("200");
    expect(find(r, ":uber-income")?.amount.toString()).toBe("20");
    expect(find(r, ":uber-cost")?.amount.toString()).toBe("20");
  });

  it("ABSORBED: cost only, no uber revenue", async () => {
    const { db } = await makeTenant("q3");
    const q = await quote(db, (await makeCustomer(db)).id, "ABSORBED", "200");
    await onQuoteApproved(db, q.id);
    const r = await rows(db);
    expect(r).toHaveLength(2);
    expect(find(r, ":uber-income")).toBeUndefined();
    expect(find(r, ":uber-cost")).toBeDefined();
  });
});

describe("onOrderDelivered", () => {
  it("creates one receivable for an order without quote, skips zero totals", async () => {
    const { db } = await makeTenant("o1");
    const c = await makeCustomer(db);
    const mk = (n: string, total: string) => db.serviceOrder.create({ data: { customerId: c.id, orderNumber: n, description: "d", totalAmount: total } as never });
    const o = await mk("1", "150");
    await onOrderDelivered(db, o.id);
    await onOrderDelivered(db, o.id);
    await onOrderDelivered(db, (await mk("2", "0")).id);
    const r = await db.financialTransaction.findMany();
    expect(r).toHaveLength(1);
    expect(r[0].allocationKey).toBe(`order:${o.id}:main`);
  });
});
