import { describe, expect, it } from "vitest";
import { makeTenant } from "../../tests/helpers";
import { createCustomer } from "./crm";
import { createCampaign, getCampaign, logContact, segmentOpportunities } from "./remarketing";

const mk = (db: Parameters<typeof createCustomer>[0], name: string, consent: boolean, optOut = false) =>
  createCustomer(db, { name, phone: "+5565999990000", marketingConsent: consent, marketingOptOut: optOut });

describe("remarketing", () => {
  it("marks marketing eligibility by consent and opt-out, operational ignores it", async () => {
    const { db } = await makeTenant("rm-seg");
    await mk(db, "Com", true);
    await mk(db, "Sem", false);
    await mk(db, "Saiu", true, true);
    const old = await db.customer.findMany();
    await db.customer.updateMany({ where: { id: { in: old.map((c) => c.id) } }, data: { createdAt: new Date(Date.now() - 120 * 86_400_000) } });
    const inactive = await segmentOpportunities(db, "inactive");
    expect(Object.fromEntries(inactive.map((o) => [o.customer.name, o.eligible]))).toEqual({ Com: true, Sem: false, Saiu: false });
    expect(inactive.find((o) => o.customer.name === "Sem")?.reason).toMatch(/consentimento/);
    const ops = await segmentOpportunities(db, "inactive", { forKind: "OPERATIONAL" });
    expect(ops.every((o) => o.eligible)).toBe(true);
  });

  it("detects pending quote and recurring customers", async () => {
    const { db } = await makeTenant("rm-q");
    const c = await mk(db, "Rec", false);
    await db.quote.create({ data: { customerId: c.id, number: "1", status: "SENT", sentAt: new Date() } as never });
    for (const n of ["1", "2", "3"]) await db.serviceOrder.create({ data: { customerId: c.id, orderNumber: n, description: "x" } as never });
    expect(await segmentOpportunities(db, "pending_quote")).toHaveLength(1);
    expect(await segmentOpportunities(db, "recurring")).toHaveLength(1);
  });

  it("blocks marketing contact without consent and runs a campaign", async () => {
    const { db } = await makeTenant("rm-camp");
    const yes = await mk(db, "Sim", true);
    const no = await mk(db, "Nao", false);
    await db.customer.updateMany({ data: { createdAt: new Date(Date.now() - 120 * 86_400_000) } });
    await expect(logContact(db, null, { customerId: no.id, kind: "MARKETING", result: "Enviado" })).rejects.toThrow(/consentimento/);
    const tpl = (await db.communicationTemplate.create({ data: { name: "M", kind: "MARKETING", body: "Oi {nome_cliente}" } as never })) as { id: string };
    const camp = await createCampaign(db, { name: "Volta", seg: "inactive", templateId: tpl.id, customerIds: [yes.id, no.id] });
    let full = await getCampaign(db, camp.id);
    expect(full.contacts.map((c) => c.customerId)).toEqual([yes.id]);
    await logContact(db, null, { customerId: yes.id, kind: "MARKETING", result: "Respondeu", campaignContactId: full.contacts[0].id });
    full = await getCampaign(db, camp.id);
    expect(full.status).toBe("DONE");
    expect(full.contacts[0].result).toBe("Respondeu");
    expect((await db.customer.findFirst({ where: { id: yes.id } }))?.lastContactAt).not.toBeNull();
  });
});

describe("marketing cannot be downgraded by the client", () => {
  it("campaign contact from a MARKETING template is blocked without consent even when the form says OPERATIONAL", async () => {
    const { db } = await makeTenant("rm-down");
    const c = await mk(db, "SemConsentimento", false);
    const tpl = await db.communicationTemplate.create({ data: { name: "promo", kind: "MARKETING", body: "oi" } as never });
    const camp = await db.campaign.create({ data: { name: "c", segment: "inactive", templateId: tpl.id } as never });
    const cc = await db.campaignContact.create({ data: { campaignId: camp.id, customerId: c.id } as never });
    await expect(logContact(db, null, { customerId: c.id, kind: "OPERATIONAL", result: "enviado", campaignContactId: cc.id })).rejects.toThrow(/marketing/i);
    expect(await db.customerInteraction.count()).toBe(0);
  });
});
