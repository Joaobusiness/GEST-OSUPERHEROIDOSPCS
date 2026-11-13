import { Decimal } from "decimal.js";
import type { TenantDb } from "@/lib/db";
import { cashSummary, TZ, type Period } from "./finance";

const D = (v: { toString(): string } | null | undefined) => new Decimal(v?.toString() ?? 0);
const CLOSED = ["COMPLETED", "DELIVERED", "CANCELED"] as const;

export interface Alert {
  key: "quotes" | "late" | "overdue" | "inactive";
  label: string;
  detail: string;
  count: number;
  href: string;
}

/** Everything the Início screen shows, from real rows only. */
export async function loadDashboard(db: TenantDb, period: Period, tz = TZ, now = new Date()) {
  const settings = await db.pricingSettings.findFirst();
  const inactiveDays = settings?.inactiveDays ?? 60;
  const cutoff = new Date(now.getTime() - inactiveDays * 86_400_000);
  const inPeriod = { gte: period.start, lt: period.end };

  const [cash, approved, open, sent, inactive, avg, late, customers, orders, transactions] = await Promise.all([
    cashSummary(db, period, tz),
    db.quote.findMany({
      where: { status: "APPROVED", decidedAt: inPeriod },
      select: { totalAmount: true, totalCost: true, taxPct: true, cardFeePct: true },
    }),
    db.serviceOrder.count({ where: { status: { notIn: [...CLOSED] } } }),
    db.quote.aggregate({ where: { status: "SENT" }, _count: true, _sum: { totalAmount: true } }),
    db.customer.count({
      where: { deletedAt: null, OR: [{ lastContactAt: { lt: cutoff } }, { lastContactAt: null, createdAt: { lt: cutoff } }] },
    }),
    db.serviceOrder.aggregate({
      where: { status: { in: ["COMPLETED", "DELIVERED"] }, OR: [{ completedAt: inPeriod }, { deliveredAt: inPeriod }] },
      _avg: { totalAmount: true },
      _count: true,
    }),
    db.serviceOrder.count({ where: { status: { notIn: [...CLOSED] }, estimatedDeliveryAt: { lt: now } } }),
    db.customer.count({ where: { deletedAt: null } }),
    db.serviceOrder.count(),
    db.financialTransaction.count(),
  ]);

  // Estimated profit: approved quotes, minus tax/card fee on the price, minus the cost snapshot.
  let billed = new Decimal(0), fees = new Decimal(0), costs = new Decimal(0);
  for (const q of approved) {
    const total = D(q.totalAmount);
    billed = billed.plus(total);
    fees = fees.plus(total.times(D(q.taxPct).plus(D(q.cardFeePct))).div(100));
    costs = costs.plus(D(q.totalCost));
  }
  const profit = billed.minus(fees).minus(costs);

  const alerts: Alert[] = [
    { key: "quotes", label: "Orçamentos aguardando aprovação", detail: "Enviados e sem resposta do cliente.", count: sent._count, href: "/orcamentos" },
    { key: "late", label: "Serviços atrasados", detail: "Passaram da data de entrega combinada.", count: late, href: "/ordens" },
    { key: "overdue", label: "Contas vencidas", detail: "Pendentes com vencimento anterior a hoje.", count: cash.lateIn.count + cash.lateOut.count, href: "/financeiro?overdue=1" },
    { key: "inactive", label: "Clientes inativos", detail: `Sem contato há mais de ${inactiveDays} dias.`, count: inactive, href: "/remarketing" },
  ];

  return {
    isEmpty: customers === 0 && orders === 0 && transactions === 0,
    received: cash.received,
    spent: cash.spent,
    estimatedProfit: { billed, fees, costs, profit, quotes: approved.length },
    inProgress: open,
    quotesWaiting: { count: sent._count, total: D(sent._sum.totalAmount) },
    toContact: inactive,
    inactiveDays,
    avgTicket: avg._count > 0 ? D(avg._avg.totalAmount) : null,
    alerts,
    attention: alerts.reduce((n, a) => n + a.count, 0),
  };
}
