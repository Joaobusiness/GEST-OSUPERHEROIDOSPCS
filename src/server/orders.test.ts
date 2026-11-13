import { describe, expect, it, vi } from "vitest";
import { makeCustomer, makeTenant } from "../../tests/helpers";

vi.mock("./finance", () => ({ onOrderDelivered: vi.fn(), onQuoteApproved: vi.fn(), createReceivable: vi.fn(), registerPayment: vi.fn() }));
import { changeStatus, createOrder, DomainError, reopenOrder, saveOrderItems } from "./orders";
import { onOrderDelivered } from "./finance";

const line = (price: string, qty = "1") => ({ kind: "PART" as const, description: "Item", quantity: qty, unitCost: "1.00", unitPrice: price });

describe("orders", () => {
  it("numbers are unique per tenant, even with concurrent creates, and restart per tenant", async () => {
    const a = await makeTenant("A"); const b = await makeTenant("B");
    const ca = await makeCustomer(a.db); const cb = await makeCustomer(b.db);
    const made = await Promise.all(Array.from({ length: 8 }, () => createOrder(a.db, a.tenantId, null, { customerId: ca.id, description: "x" })));
    expect(new Set(made.map((o) => o.orderNumber)).size).toBe(8);
    expect(made.map((o) => o.orderNumber).sort()[0]).toBe("OS-0001");
    expect((await createOrder(b.db, b.tenantId, null, { customerId: cb.id, description: "x" })).orderNumber).toBe("OS-0001");
  });

  it("refuses another tenant's customer", async () => {
    const a = await makeTenant("A"); const b = await makeTenant("B");
    const ca = await makeCustomer(a.db);
    await expect(createOrder(b.db, b.tenantId, null, { customerId: ca.id, description: "x" })).rejects.toThrow(DomainError);
  });

  it("recomputes total, logs every change, sets dates, blocks jumps back and reopens with a note", async () => {
    const t = await makeTenant("S"); const c = await makeCustomer(t.db);
    const o = await createOrder(t.db, t.tenantId, null, { customerId: c.id, description: "x" });
    const saved = await saveOrderItems(t.db, t.tenantId, o.id, [line("10.10", "2"), line("5.00")]);
    expect(saved.totalAmount.toString()).toBe("25.2");

    await changeStatus(t.db, t.tenantId, null, o.id, "COMPLETED");
    let cur = await t.db.serviceOrder.findFirstOrThrow({ where: { id: o.id } });
    expect(cur.completedAt).not.toBeNull();
    await changeStatus(t.db, t.tenantId, null, o.id, "DELIVERED", "retirou");
    cur = await t.db.serviceOrder.findFirstOrThrow({ where: { id: o.id } });
    expect(cur.deliveredAt).not.toBeNull();
    expect(onOrderDelivered).toHaveBeenCalledTimes(1);

    await expect(changeStatus(t.db, t.tenantId, null, o.id, "IN_PROGRESS")).rejects.toThrow(DomainError);
    await expect(reopenOrder(t.db, t.tenantId, null, o.id, " ")).rejects.toThrow(DomainError);
    await reopenOrder(t.db, t.tenantId, null, o.id, "defeito voltou");
    cur = await t.db.serviceOrder.findFirstOrThrow({ where: { id: o.id } });
    expect([cur.status, cur.deliveredAt]).toEqual(["IN_PROGRESS", null]);

    const log = await t.db.serviceOrderStatusLog.findMany({ where: { serviceOrderId: o.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.toStatus)).toEqual(["OPEN", "COMPLETED", "DELIVERED", "IN_PROGRESS"]);
    expect(log[3].note).toContain("defeito voltou");
  });
});
