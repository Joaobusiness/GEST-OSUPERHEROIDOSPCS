import { describe, expect, it } from "vitest";
import { forTenant } from "@/lib/db";
import { makeCustomer, makeTenant } from "./helpers";

describe("tenant isolation (forTenant)", () => {
  it("tenant B cannot read, update, delete or count tenant A's customer", async () => {
    const a = await makeTenant("A");
    const b = await makeTenant("B");
    const c = await makeCustomer(a.db, "Cliente da A");

    expect(await b.db.customer.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await b.db.customer.findFirst({ where: { id: c.id } })).toBeNull();
    expect(await b.db.customer.findMany()).toHaveLength(0);
    expect(await b.db.customer.count()).toBe(0);
    expect((await b.db.customer.updateMany({ where: { id: c.id }, data: { name: "x" } })).count).toBe(0);
    await expect(b.db.customer.update({ where: { id: c.id }, data: { name: "x" } })).rejects.toThrow();
    await expect(b.db.customer.delete({ where: { id: c.id } })).rejects.toThrow();
    expect((await b.db.customer.deleteMany({ where: { id: c.id } })).count).toBe(0);

    const still = await a.db.customer.findUnique({ where: { id: c.id } });
    expect(still?.name).toBe("Cliente da A");
  });

  it("create is stamped with the tenant even if the caller passes another tenantId", async () => {
    const a = await makeTenant("A");
    const b = await makeTenant("B");
    const c = await a.db.customer.create({ data: { name: "x", phone: "+5565999990001", tenantId: b.tenantId } as never });
    expect(c.tenantId).toBe(a.tenantId);
    expect(await forTenant(b.tenantId).customer.count()).toBe(0);
  });

  it("settings and categories are per tenant", async () => {
    const a = await makeTenant("A");
    const b = await makeTenant("B");
    const catsA = await a.db.financialCategory.findMany();
    expect(catsA.length).toBeGreaterThan(0);
    expect(catsA.every((c) => c.tenantId === a.tenantId)).toBe(true);
    expect(await b.db.financialCategory.findFirst({ where: { id: catsA[0].id } })).toBeNull();
  });

  it("update cannot move a row to another tenant", async () => {
    const a = await makeTenant("A");
    const b = await makeTenant("B");
    const c = await makeCustomer(a.db, "Fixo na A");
    await a.db.customer.update({ where: { id: c.id }, data: { name: "Renomeado", tenantId: b.tenantId } as never });
    await a.db.customer.updateMany({ where: { id: c.id }, data: { tenantId: b.tenantId } as never });
    expect((await a.db.customer.findFirst({ where: { id: c.id } }))?.tenantId).toBe(a.tenantId);
    expect(await b.db.customer.count()).toBe(0);
  });
});
