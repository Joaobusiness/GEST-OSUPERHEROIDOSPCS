import type { TenantDb } from "@/lib/db";
import { onlyDigits } from "@/lib/br";

/** Expected, user-facing failure. Actions show its message; anything else is rethrown. */
export class CrmError extends Error {}

export const DEVICE_CATEGORIES = ["Desktop", "Notebook", "Impressora", "Monitor", "Periféricos", "Outros"] as const;

export type CustomerInput = {
  name: string; phone: string; document?: string; whatsapp?: string; email?: string;
  address?: string; notes?: string; marketingConsent: boolean; marketingOptOut: boolean;
};
export type DeviceInput = {
  category: string; brand?: string; model?: string; serialNumber?: string; accessories?: string; conditionNotes?: string;
};

const DAY = 86_400_000;
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export async function inactiveDays(db: TenantDb) {
  return (await db.pricingSettings.findFirst())?.inactiveDays ?? 60;
}

export const addressText = (a: unknown) => (a && typeof a === "object" && "text" in a ? String((a as { text: unknown }).text) : "");

function customerData(i: CustomerInput) {
  return {
    name: i.name, phone: i.phone, document: i.document ? onlyDigits(i.document) : null,
    whatsapp: i.whatsapp ?? null, email: i.email ?? null, notes: i.notes ?? null,
    address: i.address ? { text: i.address } : undefined,
    marketingConsent: i.marketingConsent, marketingOptOut: i.marketingOptOut,
  };
}

export const createCustomer = (db: TenantDb, i: CustomerInput) => db.customer.create({ data: customerData(i) as never });

export async function updateCustomer(db: TenantDb, id: string, i: CustomerInput) {
  await getCustomer(db, id);
  return db.customer.update({ where: { id }, data: { ...customerData(i), address: i.address ? { text: i.address } : (null as never) } as never });
}

/** Turns the "cliente está devendo" reminder on (amount and agreed date) or off (both cleared). The customer is never deleted. */
export async function setDebt(db: TenantDb, id: string, d: { owes: false } | { owes: true; amount: string; dueDate: Date }) {
  await getCustomer(db, id);
  await db.customer.update({ where: { id }, data: d.owes ? { owes: true, owedAmount: d.amount, owedDueDate: d.dueDate } : { owes: false, owedAmount: null, owedDueDate: null } });
}

/** Customers marked as owing, earliest agreed date first (the overdue ones lead). */
export const listDebtors = (db: TenantDb) =>
  db.customer.findMany({
    where: { deletedAt: null, owes: true }, orderBy: [{ owedDueDate: "asc" }, { name: "asc" }], take: 50,
    select: { id: true, name: true, owedAmount: true, owedDueDate: true },
  });

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Active (not soft-deleted) customer of this tenant or CrmError. */
export async function getCustomer(db: TenantDb, id: string) {
  if (!UUID_RE.test(id)) throw new CrmError("Cliente não encontrado.");
  const c = await db.customer.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw new CrmError("Cliente não encontrado.");
  return c;
}

/** One page of customers (name order). `page` is clamped to the valid range. */
export async function listCustomers(db: TenantDb, q?: string, page = 1, size = 20) {
  const term = q?.trim();
  const digits = term ? onlyDigits(term) : "";
  const or: object[] = term ? [{ name: { contains: term, mode: "insensitive" } }] : [];
  if (digits.length >= 3) or.push({ phone: { contains: digits } }, { document: { contains: digits } });
  const where = { deletedAt: null, ...(or.length ? { OR: or } : {}) };
  const total = await db.customer.count({ where });
  const pages = Math.max(1, Math.ceil(total / size));
  page = Math.min(Math.max(1, page), pages);
  const [rows, days] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * size, take: size,
      include: {
        quotes: { where: { status: { in: ["SENT", "APPROVED"] } }, orderBy: { createdAt: "desc" }, select: { status: true, decidedAt: true, createdAt: true } },
      },
    }),
    inactiveDays(db),
  ]);
  const now = Date.now();
  return { total, page, pages, rows: rows.map((c) => {
    const done = c.quotes.find((x) => x.status === "APPROVED");
    const ref = done?.decidedAt ?? done?.createdAt ?? c.createdAt;
    return { ...c, inactive: now - ref.getTime() >= days * DAY, pendingQuote: c.quotes.some((x) => x.status === "SENT") };
  }) };
}

/** Soft delete when there is history, hard delete otherwise. Returns which one happened. */
export async function deleteCustomer(db: TenantDb, id: string): Promise<"soft" | "hard"> {
  await getCustomer(db, id);
  const [quotes, tx] = await Promise.all([
    db.quote.count({ where: { customerId: id } }),
    db.financialTransaction.count({ where: { customerId: id } }),
  ]);
  if (quotes + tx > 0) {
    await db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return "soft";
  }
  await db.$transaction([
    db.customerInteraction.deleteMany({ where: { customerId: id } }),
    db.customerDevice.deleteMany({ where: { customerId: id } }),
    db.customer.delete({ where: { id } }),
  ]);
  return "hard";
}

export async function touchLastContact(db: TenantDb, customerId: string) {
  await db.customer.update({ where: { id: customerId }, data: { lastContactAt: new Date() } });
}

const deviceData = (i: DeviceInput) => ({
  category: i.category, brand: i.brand ?? null, model: i.model ?? null, serialNumber: i.serialNumber ?? null,
  accessories: i.accessories ?? null, conditionNotes: i.conditionNotes ?? null,
});

export async function saveDevice(db: TenantDb, customerId: string, deviceId: string | undefined, i: DeviceInput) {
  await getCustomer(db, customerId); // parent must belong to the tenant
  if (!deviceId) return db.customerDevice.create({ data: { customerId, ...deviceData(i) } as never });
  const d = await db.customerDevice.findFirst({ where: { id: deviceId, customerId } });
  if (!d) throw new CrmError("Equipamento não encontrado.");
  return db.customerDevice.update({ where: { id: deviceId }, data: deviceData(i) });
}

export async function deleteDevice(db: TenantDb, customerId: string, deviceId: string) {
  const d = await db.customerDevice.findFirst({ where: { id: deviceId, customerId } });
  if (!d) throw new CrmError("Equipamento não encontrado.");
  await db.customerDevice.delete({ where: { id: deviceId } });
}

export type TimelineEvent = { at: Date; kind: string; title: string; detail?: string; href?: string };

/** Everything that happened with a customer, newest first. */
export async function customerTimeline(db: TenantDb, customerId: string): Promise<TimelineEvent[]> {
  const c = await getCustomer(db, customerId);
  const [devices, quotes, payments, interactions] = await Promise.all([
    db.customerDevice.findMany({ where: { customerId } }),
    db.quote.findMany({ where: { customerId } }),
    db.transactionPayment.findMany({
      where: { transaction: { type: "INCOME", customerId } },
      include: { transaction: { select: { description: true } } },
    }),
    db.customerInteraction.findMany({ where: { customerId } }),
  ]);
  const ev: TimelineEvent[] = [{ at: c.createdAt, kind: "cadastro", title: "Cliente cadastrado" }];
  for (const d of devices) ev.push({ at: d.createdAt, kind: "equipamento", title: `Equipamento: ${[d.category, d.brand, d.model].filter(Boolean).join(" ")}` });
  for (const q of quotes) {
    const href = `/orcamentos/${q.id}`;
    ev.push({ at: q.sentAt ?? q.createdAt, kind: "orcamento", title: `Orçamento ${q.number} emitido`, href });
    if (q.decidedAt && (q.status === "APPROVED" || q.status === "REJECTED"))
      ev.push({ at: q.decidedAt, kind: "orcamento", title: `Orçamento ${q.number} ${q.status === "APPROVED" ? "aprovado" : "recusado"}`, href });
  }
  for (const p of payments) ev.push({ at: p.paidAt, kind: "pagamento", title: `Pagamento recebido: ${p.transaction.description}`, detail: BRL.format(Number(p.amount)) });
  for (const i of interactions) ev.push({ at: i.createdAt, kind: "contato", title: `Contato por ${i.channel}`, detail: [i.result, i.note].filter(Boolean).join(" - ") || undefined });
  if (c.notes) ev.push({ at: c.updatedAt, kind: "nota", title: "Observações do cliente", detail: c.notes });
  return ev.sort((a, b) => b.at.getTime() - a.at.getTime());
}
