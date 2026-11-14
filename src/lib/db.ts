import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;

/** Models that carry tenantId. Every query on them goes through forTenant(). */
const TENANT_MODELS = new Set([
  "Customer", "CustomerDevice",
  "Quote", "QuoteItem", "FinancialCategory", "FinancialTransaction", "TransactionPayment",
  "PricingSimulation", "CommunicationTemplate", "Campaign", "CampaignContact",
  "CustomerInteraction", "PricingSettings", "TenantUser", "Subscription", "AuditLog",
]);

const WHERE_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "updateMany", "updateManyAndReturn", "deleteMany", "update", "delete",
]);

/**
 * Tenant-scoped Prisma client. Reads, updates and deletes are forced to the tenant;
 * creates are stamped with it. A caller cannot pass a different tenantId.
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = args as Record<string, unknown>;
          if (WHERE_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), tenantId };
            // an update can never move a row to another tenant
            if (a.data && typeof a.data === "object") delete (a.data as Record<string, unknown>).tenantId;
          } else if (operation === "create") {
            a.data = { ...(a.data as object), tenantId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = a.data as object | object[];
            a.data = Array.isArray(data) ? data.map((r) => ({ ...r, tenantId })) : { ...data, tenantId };
          } else if (operation === "upsert") {
            a.where = { ...(a.where as object), tenantId };
            a.create = { ...(a.create as object), tenantId };
            a.update = { ...(a.update as object), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof forTenant>;
