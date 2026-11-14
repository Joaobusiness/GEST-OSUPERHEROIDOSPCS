import type { TenantDb } from "@/lib/db";

/** Lists and pricing defaults the quote form needs. */
export async function quoteFormData(db: TenantDb, tenantId: string) {
  const [customers, s] = await Promise.all([
    db.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.pricingSettings.findFirst({ where: { tenantId } }),
  ]);
  return {
    customers,
    // imposto e taxa de cartão ficaram fora do MVP: sempre 0 aqui
    settings: { partMarginPct: String(s?.partMarginPct ?? 40), laborMarginPct: String(s?.laborMarginPct ?? 50), taxPct: "0", cardFeePct: "0" },
    uberDefaults: { uberMode: s?.defaultUberMode ?? ("INCLUDED" as const), uberCost: String(s?.defaultUberCost ?? 0), uberMarkup: s?.uberMarkup ?? false },
  };
}
