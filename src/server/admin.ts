import Decimal from "decimal.js";
import { z } from "zod";
import { moneyStr, optional, uuid } from "@/lib/action";
import { prisma } from "@/lib/db";
import { UserError } from "@/server/settings";

// Super Admin area: cross-tenant on purpose, so it uses prisma directly. It only ever reads
// counts and subscription data of other tenants, never customers, orders or money.

export async function listTenants() {
  const [tenants, customers, orders, members] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, status: true, createdAt: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, expiresAt: true, plan: { select: { name: true } } } },
      },
    }),
    prisma.customer.groupBy({ by: ["tenantId"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.serviceOrder.groupBy({ by: ["tenantId"], _count: { _all: true } }),
    prisma.tenantUser.groupBy({ by: ["tenantId"], _count: { _all: true } }),
  ]);
  const count = (rows: { tenantId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.tenantId, r._count._all]));
  const [c, o, m] = [count(customers), count(orders), count(members)];
  return tenants.map((t) => ({
    id: t.id, name: t.name, email: t.email, status: t.status, createdAt: t.createdAt,
    planName: t.subscriptions[0]?.plan.name ?? null,
    subscriptionStatus: t.subscriptions[0]?.status ?? null,
    expiresAt: t.subscriptions[0]?.expiresAt ?? null,
    customerCount: c.get(t.id) ?? 0, orderCount: o.get(t.id) ?? 0, userCount: m.get(t.id) ?? 0,
  }));
}

export type TenantRow = Awaited<ReturnType<typeof listTenants>>[number];

export async function platformStats() {
  const [tenants, activeTenants, users, orders, active] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.serviceOrder.count(),
    // one subscription per tenant is kept (setSubscription updates the latest), so summing is safe
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { plan: { select: { price: true, billingCycle: true } } } }),
  ]);
  const mrr = active.reduce((sum, s) => sum.plus(s.plan.billingCycle === "YEARLY" ? new Decimal(s.plan.price.toString()).div(12) : s.plan.price.toString()), new Decimal(0));
  return { tenants, activeTenants, users, orders, mrr: mrr.toDecimalPlaces(2).toFixed(2) };
}

export async function setTenantStatus(tenantId: string, status: "ACTIVE" | "SUSPENDED") {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw new UserError("Empresa não encontrada.");
  await prisma.tenant.update({ where: { id: tenantId }, data: { status } });
  // a suspended tenant loses open sessions at once; requireAuth also redirects them to /suspenso
  if (status === "SUSPENDED") await prisma.session.deleteMany({ where: { tenantId } });
}

export const planSchema = z.object({
  id: optional(uuid),
  name: z.string().min(2, "Informe o nome do plano."),
  description: optional(z.string().max(300)),
  price: moneyStr,
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

export async function savePlan(d: z.infer<typeof planSchema>) {
  const data = { name: d.name, description: d.description ?? null, price: d.price, billingCycle: d.billingCycle };
  if (!d.id) return (await prisma.subscriptionPlan.create({ data })).id;
  await prisma.subscriptionPlan.update({ where: { id: d.id }, data });
  return d.id;
}

export async function setPlanActive(planId: string, isActive: boolean) {
  await prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive } });
}

export const subscriptionSchema = z.object({
  tenantId: uuid, planId: uuid,
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED"]),
  expiresAt: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")),
});

export async function setSubscription(d: z.infer<typeof subscriptionSchema>) {
  if (!(await prisma.subscriptionPlan.findUnique({ where: { id: d.planId } }))) throw new UserError("Plano não encontrado.");
  const expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59Z`) : null;
  const last = await prisma.subscription.findFirst({ where: { tenantId: d.tenantId }, orderBy: { createdAt: "desc" } });
  if (last) await prisma.subscription.update({ where: { id: last.id }, data: { planId: d.planId, status: d.status, expiresAt } });
  else await prisma.subscription.create({ data: { tenantId: d.tenantId, planId: d.planId, status: d.status, expiresAt } });
}
