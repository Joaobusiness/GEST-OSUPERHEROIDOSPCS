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

/** Active (not soft-deleted) customer of this tenant or CrmError. */
export async function getCustomer(db: TenantDb, id: string) {
  const c = await db.customer.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw new CrmError("Cliente não encontrado.");
  return c;
}

export async function listCustomers(db: TenantDb, q?: string) {
  const term = q?.trim();
  const digits = term ? onlyDigits(term) : "";
  const or: object[] = term ? [{ name: { contains: term, mode: "insensitive" } }] : [];
  if (digits.length >= 3) or.push({ phone: { contains: digits } }, { document: { contains: digits } });
  const [rows, days] = await Promise.all([
    db.customer.findMany({
      where: { deletedAt: null, ...(or.length ? { OR: or } : {}) },
      orderBy: { name: "asc" },
      take: 200, // shortcut: no pagination, add cursor paging past ~200 matches
      include: {
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        quotes: { where: { status: "SENT" }, take: 1, select: { id: true } },
      },
    }),
    inactiveDays(db),
  ]);
  const now = Date.now();
  return rows.map((c) => {
    const ref = c.orders[0]?.createdAt ?? c.createdAt;
    return { ...c, inactive: now - ref.getTime() >= days * DAY, pendingQuote: c.quotes.length > 0 };
  });
}

/** Soft delete when there is history, hard delete otherwise. Returns which one happened. */
export async function deleteCustomer(db: TenantDb, id: string): Promise<"soft" | "hard"> {
  await getCustomer(db, id);
  const [orders, quotes, tx] = await Promise.all([
    db.serviceOrder.count({ where: { customerId: id } }),
    db.quote.count({ where: { customerId: id } }),
    db.financialTransaction.count({ where: { customerId: id } }),
  ]);
  if (orders + quotes + tx > 0) {
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
  if ((await db.serviceOrder.count({ where: { deviceId } })) > 0)
    throw new CrmError("Este equipamento tem ordens de serviço e não pode ser excluído.");
  await db.customerDevice.delete({ where: { id: deviceId } });
}

export type TimelineEvent = { at: Date; kind: string; title: string; detail?: string; href?: string };

/** Everything that happened with a customer, newest first. */
export async function customerTimeline(db: TenantDb, customerId: string): Promise<TimelineEvent[]> {
  const c = await getCustomer(db, customerId);
  const [devices, quotes, orders, payments, interactions] = await Promise.all([
    db.customerDevice.findMany({ where: { customerId } }),
    db.quote.findMany({ where: { customerId } }),
    db.serviceOrder.findMany({ where: { customerId } }),
    db.transactionPayment.findMany({
      where: { transaction: { type: "INCOME", OR: [{ customerId }, { serviceOrder: { customerId } }] } },
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
  for (const o of orders) {
    const href = `/ordens/${o.id}`;
    ev.push({ at: o.createdAt, kind: "os", title: `OS ${o.orderNumber} aberta`, detail: o.description, href });
    if (o.completedAt) ev.push({ at: o.completedAt, kind: "os", title: `OS ${o.orderNumber} concluída`, href });
    if (o.deliveredAt) {
      ev.push({ at: o.deliveredAt, kind: "os", title: `OS ${o.orderNumber} entregue`, href });
      if (o.warrantyDays > 0)
        ev.push({ at: new Date(o.deliveredAt.getTime() + o.warrantyDays * DAY), kind: "garantia", title: `Garantia da OS ${o.orderNumber} termina`, detail: `${o.warrantyDays} dias`, href });
    }
  }
  for (const p of payments) ev.push({ at: p.paidAt, kind: "pagamento", title: `Pagamento recebido: ${p.transaction.description}`, detail: BRL.format(Number(p.amount)) });
  for (const i of interactions) ev.push({ at: i.createdAt, kind: "contato", title: `Contato por ${i.channel}`, detail: [i.result, i.note].filter(Boolean).join(" - ") || undefined });
  if (c.notes) ev.push({ at: c.updatedAt, kind: "nota", title: "Observações do cliente", detail: c.notes });
  return ev.sort((a, b) => b.at.getTime() - a.at.getTime());
}
