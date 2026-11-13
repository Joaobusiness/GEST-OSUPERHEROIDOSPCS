import Decimal from "decimal.js";
import type { TenantDb } from "@/lib/db";
import type { ServiceOrderStatus } from "@/generated/prisma/client";
import { onOrderDelivered } from "./finance";
import { itemsTotal, type Line } from "./line-items";

export type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];

/** Expected, user-facing failure (pt-BR message). Actions turn it into an ActionState. */
export class DomainError extends Error {}

/** Per-tenant sequence. One atomic UPDATE ... RETURNING, so concurrent creates never repeat a number. */
export async function nextOrderNumber(tx: Pick<Tx, "tenant">, tenantId: string) {
  const t = await tx.tenant.update({ where: { id: tenantId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
  return `OS-${String(t.orderSeq).padStart(4, "0")}`;
}

const CLOSED: ServiceOrderStatus[] = ["DELIVERED", "CANCELED"];

export type NewOrder = {
  customerId: string; deviceId?: string; description: string; estimatedDeliveryAt?: Date; warrantyDays?: number;
  items?: Line[]; quoteNote?: string;
};

export async function createOrder(db: TenantDb, tenantId: string, userId: string | null, input: NewOrder) {
  const customer = await db.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
  if (!customer) throw new DomainError("Cliente não encontrado.");
  if (input.deviceId && !(await db.customerDevice.findFirst({ where: { id: input.deviceId, customerId: customer.id } })))
    throw new DomainError("Equipamento não pertence a este cliente.");
  return db.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx, tenantId);
    const order = await tx.serviceOrder.create({
      data: {
        tenantId, customerId: customer.id, deviceId: input.deviceId, orderNumber, description: input.description,
        estimatedDeliveryAt: input.estimatedDeliveryAt, warrantyDays: input.warrantyDays ?? 0,
        totalAmount: itemsTotal(input.items ?? []).toFixed(2),
      },
    });
    if (input.items?.length) await tx.serviceOrderItem.createMany({ data: input.items.map((i) => ({ ...i, tenantId, serviceOrderId: order.id })) });
    await tx.serviceOrderStatusLog.create({ data: { tenantId, serviceOrderId: order.id, toStatus: "OPEN", userId, note: input.quoteNote ?? "OS aberta" } });
    return order;
  });
}

async function openOrder(db: TenantDb, id: string) {
  const o = await db.serviceOrder.findFirst({ where: { id } });
  if (!o) throw new DomainError("OS não encontrada.");
  return o;
}

export async function updateOrderDetails(db: TenantDb, id: string, d: { description: string; diagnosis?: string; notes?: string; warrantyDays: number; estimatedDeliveryAt?: Date }) {
  const o = await openOrder(db, id);
  if (CLOSED.includes(o.status)) throw new DomainError("OS encerrada. Reabra para editar.");
  return db.serviceOrder.update({ where: { id }, data: { ...d, diagnosis: d.diagnosis ?? null, notes: d.notes ?? null, estimatedDeliveryAt: d.estimatedDeliveryAt ?? null } });
}

/** Replaces all items and recomputes totalAmount in the same transaction. */
export async function saveOrderItems(db: TenantDb, tenantId: string, id: string, items: Line[]) {
  const o = await openOrder(db, id);
  if (CLOSED.includes(o.status)) throw new DomainError("OS encerrada. Reabra para editar.");
  return db.$transaction(async (tx) => {
    await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: id } });
    if (items.length) await tx.serviceOrderItem.createMany({ data: items.map((i) => ({ ...i, tenantId, serviceOrderId: id })) });
    return tx.serviceOrder.update({ where: { id }, data: { totalAmount: itemsTotal(items).toFixed(2) } });
  });
}

async function move(db: TenantDb, tenantId: string, userId: string | null, o: { id: string; status: ServiceOrderStatus; completedAt: Date | null }, to: ServiceOrderStatus, note: string | undefined, extra: Record<string, unknown> = {}) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    // status in the WHERE makes a concurrent double change fail instead of logging twice
    const r = await tx.serviceOrder.updateMany({ where: { id: o.id, status: o.status }, data: { status: to, ...extra } });
    if (r.count !== 1) throw new DomainError("A OS mudou de status. Atualize a página.");
    await tx.serviceOrderStatusLog.create({ data: { tenantId, serviceOrderId: o.id, fromStatus: o.status, toStatus: to, userId, note: note || null, createdAt: now } });
  });
}

export async function changeStatus(db: TenantDb, tenantId: string, userId: string | null, id: string, to: ServiceOrderStatus, note?: string) {
  const o = await openOrder(db, id);
  if (CLOSED.includes(o.status)) throw new DomainError("OS encerrada. Use Reabrir OS, com uma observação.");
  if (o.status === to) throw new DomainError("A OS já está neste status.");
  const now = new Date();
  await move(db, tenantId, userId, o, to, note, {
    completedAt: to === "COMPLETED" ? now : to === "DELIVERED" ? (o.completedAt ?? now) : null,
    ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
  });
  // after commit; finance is idempotent, so a retry is safe if it fails
  if (to === "DELIVERED") await onOrderDelivered(db, id);
}

/** Only way back from DELIVERED/CANCELED. The note is mandatory and ends up in the history. */
export async function reopenOrder(db: TenantDb, tenantId: string, userId: string | null, id: string, note: string) {
  const o = await openOrder(db, id);
  if (!CLOSED.includes(o.status)) throw new DomainError("Só é possível reabrir OS entregue ou cancelada.");
  if (!note.trim()) throw new DomainError("Informe o motivo para reabrir.");
  await move(db, tenantId, userId, o, o.status === "CANCELED" ? "OPEN" : "IN_PROGRESS", `Reaberta: ${note.trim()}`, { completedAt: null, deliveredAt: null });
}

export type FinanceState = "NONE" | "PENDING" | "PARTIAL" | "PAID";

/** Money side of an order, derived from receivables (own or via its quotes) and their payments. Independent of the order status. */
export async function orderFinance(db: TenantDb, id: string) {
  const quotes = await db.quote.findMany({ where: { serviceOrderId: id }, select: { id: true } });
  const txs = await db.financialTransaction.findMany({
    where: { type: "INCOME", status: { not: "CANCELED" }, OR: [{ serviceOrderId: id }, { quoteId: { in: quotes.map((q) => q.id) } }] },
    include: { payments: true }, orderBy: { dueDate: "asc" },
  });
  const total = txs.reduce((a, t) => a.plus(t.amount.toString()), new Decimal(0));
  const paid = txs.reduce((a, t) => t.payments.reduce((b, p) => b.plus(p.amount.toString()), a), new Decimal(0));
  const state: FinanceState = !txs.length ? "NONE" : paid.gte(total) ? "PAID" : paid.gt(0) ? "PARTIAL" : "PENDING";
  return { total, paid, open: Decimal.max(total.minus(paid), 0), state, txs };
}

export async function listOrders(db: TenantDb, f: { status?: ServiceOrderStatus; q?: string }) {
  const q = f.q?.trim();
  return db.serviceOrder.findMany({
    where: {
      ...(f.status ? { status: f.status } : {}),
      ...(q ? { OR: [
        { orderNumber: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { device: { OR: [{ brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] } },
      ] } : {}),
    },
    include: { customer: { select: { name: true } }, device: { select: { category: true, brand: true, model: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
}
