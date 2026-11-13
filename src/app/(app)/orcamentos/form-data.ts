import type { TenantDb } from "@/lib/db";

/** Lists and pricing defaults the quote form needs. */
export async function quoteFormData(db: TenantDb, tenantId: string) {
  const [customers, orders, s] = await Promise.all([
    db.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.serviceOrder.findMany({ select: { id: true, orderNumber: true, customerId: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.pricingSettings.findFirst({ where: { tenantId } }),
  ]);
  return {
    customers,
    orders: orders.map((o) => ({ id: o.id, number: o.orderNumber, customerId: o.customerId })),
    settings: {
      partMarginPct: String(s?.partMarginPct ?? 40), laborMarginPct: String(s?.laborMarginPct ?? 50),
      taxPct: String(s?.taxPct ?? 0), cardFeePct: String(s?.cardFeePct ?? 0),
    },
    uberDefaults: { uberMode: s?.defaultUberMode ?? ("INCLUDED" as const), uberCost: String(s?.defaultUberCost ?? 0), uberMarkup: s?.uberMarkup ?? false },
  };
}
