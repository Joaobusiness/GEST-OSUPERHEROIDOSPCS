import { describe, expect, it } from "vitest";
import { makeTenant } from "../../tests/helpers";
import { createCustomer, customerTimeline, deleteCustomer, getCustomer, listCustomers, saveDevice, touchLastContact } from "./crm";

const base = { phone: "+5565999990000", marketingConsent: false, marketingOptOut: false };

describe("crm", () => {
  it("searches by name, phone and document, and hides other tenants", async () => {
    const a = await makeTenant("crm-a");
    const b = await makeTenant("crm-b");
    await createCustomer(a.db, { ...base, name: "Maria Silva", document: "529.982.247-25" });
    await createCustomer(b.db, { ...base, name: "Maria Outra" });
    expect((await listCustomers(a.db, "maria")).map((c) => c.name)).toEqual(["Maria Silva"]);
    expect(await listCustomers(a.db, "65 99999")).toHaveLength(1);
    expect(await listCustomers(a.db, "52998224725")).toHaveLength(1);
    expect(await listCustomers(a.db, "zzz")).toHaveLength(0);
  });

  it("soft deletes customers with history, hard deletes without", async () => {
    const { db } = await makeTenant("crm-del");
    const clean = await createCustomer(db, { ...base, name: "Sem historico" });
    const used = await createCustomer(db, { ...base, name: "Com historico" });
    await db.quote.create({ data: { customerId: used.id, number: "1", status: "APPROVED" } as never });
    expect(await deleteCustomer(db, clean.id)).toBe("hard");
    expect(await deleteCustomer(db, used.id)).toBe("soft");
    expect(await listCustomers(db)).toHaveLength(0);
    expect(await db.customer.count({ where: { id: used.id } })).toBe(1);
  });

  it("rejects devices for a customer of another tenant", async () => {
    const a = await makeTenant("crm-dev-a");
    const b = await makeTenant("crm-dev-b");
    const c = await createCustomer(a.db, { ...base, name: "A" });
    await expect(saveDevice(b.db, c.id, undefined, { category: "Notebook" })).rejects.toThrow("Cliente não encontrado");
  });

  it("builds a timeline newest first and touches last contact", async () => {
    const { db } = await makeTenant("crm-tl");
    const c = await createCustomer(db, { ...base, name: "Ana", notes: "Prefere manha" });
    await saveDevice(db, c.id, undefined, { category: "Desktop", brand: "Dell" });
    await db.quote.create({ data: { customerId: c.id, number: "7", status: "APPROVED", decidedAt: new Date(Date.now() - 10 * 86_400_000) } as never });
    await db.customerInteraction.create({ data: { customerId: c.id, result: "Respondeu" } as never });
    await touchLastContact(db, c.id);
    expect((await getCustomer(db, c.id)).lastContactAt).not.toBeNull();
    const tl = await customerTimeline(db, c.id);
    const kinds = tl.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["cadastro", "equipamento", "orcamento", "contato", "nota"]));
    expect(tl.map((e) => +e.at)).toEqual([...tl.map((e) => +e.at)].sort((x, y) => y - x));
  });
});
