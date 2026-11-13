import { describe, expect, it } from "vitest";
import { makeCustomer, makeTenant } from "../../tests/helpers";
import { loadDashboard } from "./dashboard";
import { createReceivable, registerPayment, resolvePeriod } from "./finance";

describe("resolvePeriod (America/Sao_Paulo)", () => {
  it("day boundaries are local midnight (UTC-3)", () => {
    const p = resolvePeriod({ p: "hoje" }, "America/Sao_Paulo", new Date("2026-03-10T02:30:00Z")); // still Mar 9 locally
    expect(p.from).toBe("2026-03-09");
    expect(p.start.toISOString()).toBe("2026-03-09T03:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-03-10T03:00:00.000Z");
  });
  it("month, previous month and invalid custom fallback", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolvePeriod({ p: "mes" }, undefined, now)).toMatchObject({ from: "2026-03-01", to: "2026-03-31" });
    expect(resolvePeriod({ p: "mes-anterior" }, undefined, now)).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolvePeriod({ p: "custom", de: "2026-02-31", ate: "2026-03-01" }, undefined, now).key).toBe("30d");
  });
});

describe("loadDashboard", () => {
  it("counts only payments inside the local-day boundaries, never pending", async () => {
    const { db } = await makeTenant("dash");
    const empty = await loadDashboard(db, resolvePeriod({}));
    expect(empty.isEmpty).toBe(true);

    const c = await makeCustomer(db);
    const t = await createReceivable(db, { customerId: c.id, amount: "300", description: "x", dueDate: new Date("2026-03-05T00:00:00Z"), allocationKey: "k1" });
    await registerPayment(db, t.id, { amount: "100", paidAt: new Date("2026-03-01T02:59:59Z") }); // Feb 28 23:59:59 local
    await registerPayment(db, t.id, { amount: "50", paidAt: new Date("2026-03-01T03:00:00Z") }); // Mar 1 00:00 local
    await registerPayment(db, t.id, { amount: "25", paidAt: new Date("2026-04-01T02:59:59Z") }); // Mar 31 23:59:59 local
    await registerPayment(db, t.id, { amount: "10", paidAt: new Date("2026-04-01T03:00:00Z") }); // Apr 1 local

    const d = await loadDashboard(db, resolvePeriod({ p: "custom", de: "2026-03-01", ate: "2026-03-31" }));
    expect(d.isEmpty).toBe(false);
    expect(d.received.toFixed(2)).toBe("75.00"); // 50 + 25; 115 still pending is not received
  });
});
