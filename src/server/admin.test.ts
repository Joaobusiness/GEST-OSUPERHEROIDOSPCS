import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeCustomer, makeTenant } from "../../tests/helpers";
import { listTenants, platformStats, setSubscription, setTenantStatus } from "./admin";

describe("admin", () => {
  it("listing exposes counts only, never tenant business data", async () => {
    const { tenantId, db } = await makeTenant("adm");
    await makeCustomer(db, "Cliente Secreto");
    await makeCustomer(db, "Outro Segredo");
    const row = (await listTenants()).find((t) => t.id === tenantId)!;
    expect(row.customerCount).toBe(2);
    expect(row.orderCount).toBe(0);
    expect(Object.keys(row).sort()).toEqual([
      "createdAt", "customerCount", "email", "expiresAt", "id", "name", "orderCount", "planName", "status", "subscriptionStatus", "userCount",
    ]);
    expect(JSON.stringify(row)).not.toContain("Secreto");
  });

  it("suspend flips status and kills sessions; reactivate restores", async () => {
    const { tenantId } = await makeTenant("sus");
    const u = await prisma.user.create({ data: { email: `s-${tenantId}@t.local`, name: "U", passwordHash: "x" } });
    await prisma.session.create({ data: { id: `sess-${tenantId}`, userId: u.id, tenantId, expiresAt: new Date(Date.now() + 1e6) } });
    await setTenantStatus(tenantId, "SUSPENDED");
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })).status).toBe("SUSPENDED");
    expect(await prisma.session.count({ where: { tenantId } })).toBe(0);
    await setTenantStatus(tenantId, "ACTIVE");
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })).status).toBe("ACTIVE");
  });

  it("setSubscription updates the single subscription and feeds MRR", async () => {
    const { tenantId } = await makeTenant("sub");
    const plan = await prisma.subscriptionPlan.create({ data: { name: `p-${tenantId}`, price: "120.00", billingCycle: "YEARLY" } });
    const before = await platformStats();
    await setSubscription({ tenantId, planId: plan.id, status: "ACTIVE", expiresAt: "2030-01-31" });
    expect(await prisma.subscription.count({ where: { tenantId } })).toBe(1);
    const after = await platformStats();
    expect(Number(after.mrr) - Number(before.mrr)).toBeCloseTo(10, 2);
  });
});
