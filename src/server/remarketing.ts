import type { TenantDb } from "@/lib/db";
import { fillTemplate } from "@/lib/br";
import { CrmError, getCustomer } from "@/server/crm";

type Kind = "OPERATIONAL" | "MARKETING";
const DAY = 86_400_000;

export const SEGMENTS = {
  inactive: { label: "Sem atendimento", kind: "MARKETING" },
  pending_quote: { label: "Orçamento pendente", kind: "OPERATIONAL" },
  rejected_quote: { label: "Orçamento recusado", kind: "MARKETING" },
  completed: { label: "Serviço concluído", kind: "OPERATIONAL" },
  warranty: { label: "Garantia perto de vencer", kind: "OPERATIONAL" },
  recurring: { label: "Clientes recorrentes", kind: "MARKETING" },
} as const satisfies Record<string, { label: string; kind: Kind }>;
export type SegmentId = keyof typeof SEGMENTS;
export const isSegment = (s: string): s is SegmentId => s in SEGMENTS;

/** Reason a customer may not receive marketing, or undefined when allowed. Consent is never presumed. */
export function marketingBlock(c: { marketingConsent: boolean; marketingOptOut: boolean }) {
  if (c.marketingOptOut) return "Pediu para não receber marketing.";
  if (!c.marketingConsent) return "Sem consentimento de marketing.";
  return undefined;
}

export type Opportunity = {
  customer: { id: string; name: string; phone: string; whatsapp: string | null };
  lastOrderAt: Date | null; lastService: string | null; daysInactive: number;
  opportunity: string; eligible: boolean; reason?: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Customers matching a segment, computed from real data. `forKind` is the kind of message that will be sent. */
export async function segmentOpportunities(db: TenantDb, seg: SegmentId, opts: { days?: number; forKind?: Kind } = {}): Promise<Opportunity[]> {
  const [settings, customers] = await Promise.all([
    db.pricingSettings.findFirst(),
    db.customer.findMany({
      where: { deletedAt: null },
      include: {
        orders: { where: { status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, description: true, status: true, completedAt: true, deliveredAt: true, warrantyDays: true } },
        quotes: { select: { status: true, sentAt: true, createdAt: true, decidedAt: true } },
      },
    }),
  ]);
  const days = opts.days ?? settings?.inactiveDays ?? 60;
  const alertDays = settings?.warrantyAlertDays ?? 15;
  const now = Date.now();
  const kind = opts.forKind ?? SEGMENTS[seg].kind;
  const out: Opportunity[] = [];
  for (const c of customers) {
    const last = c.orders[0];
    const daysInactive = Math.floor((now - (last?.createdAt ?? c.createdAt).getTime()) / DAY);
    let opportunity: string | undefined;
    if (seg === "inactive") {
      if (daysInactive >= days) opportunity = `Sem atendimento há ${daysInactive} dias`;
    } else if (seg === "pending_quote") {
      const q = c.quotes.filter((x) => x.status === "SENT").sort((a, b) => +(b.sentAt ?? b.createdAt) - +(a.sentAt ?? a.createdAt))[0];
      if (q) opportunity = `Orçamento enviado há ${plural(Math.floor((now - +(q.sentAt ?? q.createdAt)) / DAY), "dia", "dias")}`;
    } else if (seg === "rejected_quote") {
      if (c.quotes.some((x) => x.status === "REJECTED")) opportunity = "Recusou um orçamento";
    } else if (seg === "completed") {
      // shortcut: fixed 30-day window for post-service follow-up, make it a setting if asked
      const ages = c.orders
        .filter((x) => x.status === "COMPLETED" || x.status === "DELIVERED")
        .map((x) => x.deliveredAt ?? x.completedAt)
        .filter((d): d is Date => !!d)
        .map((d) => Math.floor((now - +d) / DAY))
        .filter((a) => a >= 0 && a <= 30);
      if (ages.length) opportunity = `Serviço concluído há ${plural(Math.min(...ages), "dia", "dias")}`;
    } else if (seg === "warranty") {
      const exp = c.orders
        .filter((x) => x.deliveredAt && x.warrantyDays > 0)
        .map((x) => +x.deliveredAt! + x.warrantyDays * DAY)
        .filter((e) => e >= now && e <= now + alertDays * DAY)
        .sort((a, b) => a - b)[0];
      if (exp) opportunity = `Garantia termina em ${plural(Math.ceil((exp - now) / DAY), "dia", "dias")}`;
    } else if (c.orders.length >= 3) {
      opportunity = `${c.orders.length} serviços feitos`;
    }
    if (!opportunity) continue;
    const reason = kind === "MARKETING" ? marketingBlock(c) : undefined;
    out.push({
      customer: { id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp },
      lastOrderAt: last?.createdAt ?? null, lastService: last?.description ?? null, daysInactive, opportunity, eligible: !reason, reason,
    });
  }
  return out.sort((a, b) => b.daysInactive - a.daysInactive);
}

// ---- templates ----

export const CONTACT_RESULTS = ["Respondeu", "Sem resposta", "Agendou serviço", "Orçamento aprovado", "Sem interesse"];

export const TEMPLATE_VARS = ["{nome_cliente}", "{ultimo_servico}", "{data_atendimento}", "{nome_empresa}", "{telefone_empresa}"];

export const listTemplates = (db: TenantDb) => db.communicationTemplate.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });

export async function saveTemplate(db: TenantDb, id: string | undefined, d: { name: string; kind: Kind; body: string }) {
  if (!id) return db.communicationTemplate.create({ data: d as never });
  if (!(await db.communicationTemplate.findFirst({ where: { id } }))) throw new CrmError("Modelo não encontrado.");
  return db.communicationTemplate.update({ where: { id }, data: d });
}

export async function deleteTemplate(db: TenantDb, id: string) {
  await db.communicationTemplate.deleteMany({ where: { id } });
}

/** Message text for one customer: placeholders filled from their last service and the tenant. */
export async function buildMessage(db: TenantDb, tenant: { name: string; phone: string | null; whatsapp: string | null; timezone: string }, customerId: string, body: string) {
  const c = await getCustomer(db, customerId);
  const last = await db.serviceOrder.findFirst({ where: { customerId, status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" } });
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, day: "2-digit", month: "2-digit", year: "numeric" }).format(last?.createdAt ?? c.createdAt);
  return fillTemplate(body, {
    nome_cliente: c.name.split(" ")[0],
    ultimo_servico: last?.description ?? "seu equipamento",
    data_atendimento: date,
    nome_empresa: tenant.name,
    telefone_empresa: tenant.whatsapp ?? tenant.phone ?? "",
  });
}

// ---- contact log ----

/** Records that the user contacted a customer. Marketing needs consent, checked again here. */
export async function logContact(db: TenantDb, userId: string | null, i: { customerId: string; kind: Kind; result: string; note?: string; campaignContactId?: string }) {
  const c = await getCustomer(db, i.customerId);
  // The kind comes from the campaign's template, never only from the form: a client cannot downgrade marketing to operational.
  if (i.campaignContactId) {
    const cc = await db.campaignContact.findFirst({ where: { id: i.campaignContactId, customerId: i.customerId }, include: { campaign: true } });
    const tpl = cc?.campaign.templateId ? await db.communicationTemplate.findFirst({ where: { id: cc.campaign.templateId } }) : null;
    if (tpl?.kind === "MARKETING") i = { ...i, kind: "MARKETING" };
  }
  if (i.kind === "MARKETING") {
    const reason = marketingBlock(c);
    if (reason) throw new CrmError(`Não é possível enviar marketing: ${reason}`);
  }
  await db.$transaction(async (tx) => {
    if (i.campaignContactId) {
      const cc = await tx.campaignContact.findFirst({ where: { id: i.campaignContactId, customerId: i.customerId } });
      if (!cc) throw new CrmError("Contato da campanha não encontrado.");
      await tx.campaignContact.update({ where: { id: cc.id }, data: { contactedAt: new Date(), result: i.result } });
      const pending = await tx.campaignContact.count({ where: { campaignId: cc.campaignId, contactedAt: null } });
      await tx.campaign.update({ where: { id: cc.campaignId }, data: { status: pending ? "ACTIVE" : "DONE" } });
    }
    await tx.customerInteraction.create({ data: { customerId: i.customerId, kind: i.kind, result: i.result, note: i.note ?? null, userId } as never });
    await tx.customer.update({ where: { id: i.customerId }, data: { lastContactAt: new Date() } });
  });
}

// ---- campaigns ----

export const segmentKey = (seg: SegmentId, days?: number) => (seg === "inactive" && days ? `inactive:${days}` : seg);
export function parseSegmentKey(key: string): { seg: SegmentId; days?: number } | null {
  const [s, d] = key.split(":");
  return isSegment(s) ? { seg: s, days: d ? Number(d) : undefined } : null;
}

export async function createCampaign(db: TenantDb, i: { name: string; seg: SegmentId; days?: number; templateId: string; customerIds: string[] }) {
  const tpl = await db.communicationTemplate.findFirst({ where: { id: i.templateId } });
  if (!tpl) throw new CrmError("Modelo não encontrado.");
  const marketing = tpl.kind === "MARKETING" || SEGMENTS[i.seg].kind === "MARKETING";
  const opps = await segmentOpportunities(db, i.seg, { days: i.days, forKind: marketing ? "MARKETING" : "OPERATIONAL" });
  const ids = new Set(i.customerIds);
  const chosen = opps.filter((o) => ids.has(o.customer.id) && o.eligible);
  if (!chosen.length) throw new CrmError("Nenhum cliente elegível selecionado.");
  return db.$transaction(async (tx) => {
    const camp = await tx.campaign.create({ data: { name: i.name, segment: segmentKey(i.seg, i.days), templateId: tpl.id } as never });
    await tx.campaignContact.createMany({ data: chosen.map((o) => ({ campaignId: camp.id, customerId: o.customer.id })) as never });
    return camp;
  });
}

export async function listCampaigns(db: TenantDb) {
  const rows = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { contacts: { select: { contactedAt: true } } } });
  return rows.map((c) => ({ ...c, total: c.contacts.length, done: c.contacts.filter((x) => x.contactedAt).length }));
}

export async function getCampaign(db: TenantDb, id: string) {
  const camp = await db.campaign.findFirst({ where: { id }, include: { contacts: true } });
  if (!camp) throw new CrmError("Campanha não encontrada.");
  const [customers, template] = await Promise.all([
    db.customer.findMany({ where: { id: { in: camp.contacts.map((c) => c.customerId) } }, select: { id: true, name: true, phone: true } }),
    camp.templateId ? db.communicationTemplate.findFirst({ where: { id: camp.templateId } }) : null,
  ]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  return { ...camp, template, contacts: camp.contacts.map((c) => ({ ...c, customer: byId.get(c.customerId) })) };
}
