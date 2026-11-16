import { describe, expect, it } from "vitest";
import { makeTenant } from "../../tests/helpers";
import { createCustomer, customerTimeline, deleteCustomer, getCustomer, listCustomers, listDebtors, saveDevice, setDebt, touchLastContact } from "./crm";

const base = { phone: "+5565999990000", marketingConsent: false, marketingOptOut: false };

describe("crm", () => {
  it("debt reminder: on lists the customer, off removes it from the list but keeps the customer", async () => {
    const a = await makeTenant("crm-debt");
    const b = await makeTenant("crm-debt-b");
    const maria = await createCustomer(a.db, { ...base, name: "Maria" });
    const other = await createCustomer(b.db, { ...base, name: "Outra empresa" });
    await setDebt(a.db, maria.id, { owes: true, amount: "150.50", dueDate: new Date("2026-12-05T00:00:00Z") });
    await setDebt(b.db, other.id, { owes: true, amount: "10", dueDate: new Date("2026-12-01T00:00:00Z") });
    const list = await listDebtors(a.db);
    expect(list.map((c) => [c.name, c.owedAmount?.toString(), c.owedDueDate?.toISOString().slice(0, 10)])).toEqual([["Maria", "150.5", "2026-12-05"]]);
    await setDebt(a.db, maria.id, { owes: false });
    expect(await listDebtors(a.db)).toHaveLength(0);
    const kept = await getCustomer(a.db, maria.id);
    expect([kept.name, kept.owes, kept.owedAmount, kept.owedDueDate]).toEqual(["Maria", false, null, null]);
    expect(await listDebtors(b.db)).toHaveLength(1);
  });

  it("paginates customers: 20 per page, every customer exactly once, page clamped", async () => {
    const { db } = await makeTenant("crm-pg");
    for (let i = 0; i < 45; i++) await createCustomer(db, { ...base, name: `Cliente ${String(i).padStart(2, "0")}` });
    const p1 = await listCustomers(db, undefined, 1), p3 = await listCustomers(db, undefined, 3);
    expect([p1.total, p1.pages, p1.rows.length, p3.rows.length]).toEqual([45, 3, 20, 5]);
    const all = [p1, await listCustomers(db, undefined, 2), p3].flatMap((p) => p.rows.map((c) => c.id));
    expect(new Set(all).size).toBe(45);
    expect((await listCustomers(db, undefined, 99)).page).toBe(3);
    expect((await listCustomers(db, "Cliente 4", 1)).total).toBe(5);
  });

  it("searches by name, phone and document, and hides other tenants", async () => {
    const a = await makeTenant("crm-a");
    const b = await makeTenant("crm-b");
    await createCustomer(a.db, { ...base, name: "Maria Silva", document: "529.982.247-25" });
    await createCustomer(b.db, { ...base, name: "Maria Outra" });
    expect((await listCustomers(a.db, "maria")).rows.map((c) => c.name)).toEqual(["Maria Silva"]);
    expect((await listCustomers(a.db, "65 99999")).rows).toHaveLength(1);
    expect((await listCustomers(a.db, "52998224725")).rows).toHaveLength(1);
    expect((await listCustomers(a.db, "zzz")).rows).toHaveLength(0);
  });

  it("soft deletes customers with history, hard deletes without", async () => {
    const { db } = await makeTenant("crm-del");
    const clean = await createCustomer(db, { ...base, name: "Sem historico" });
    const used = await createCustomer(db, { ...base, name: "Com historico" });
    await db.quote.create({ data: { customerId: used.id, number: "1", status: "APPROVED" } as never });
    expect(await deleteCustomer(db, clean.id)).toBe("hard");
    expect(await deleteCustomer(db, used.id)).toBe("soft");
    expect((await listCustomers(db)).rows).toHaveLength(0);
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
