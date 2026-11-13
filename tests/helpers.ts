import { forTenant, prisma } from "@/lib/db";
import { bootstrapTenant } from "@/server/tenant";

let n = 0;

/** Fresh tenant with default categories/templates/settings. Each test owns its tenant. */
export async function makeTenant(label = "t") {
  const name = `${label}-${Date.now()}-${n++}`;
  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({ data: { name, email: `${name}@test.local` } });
    await bootstrapTenant(tx, t.id);
    return t;
  });
  return { tenant, tenantId: tenant.id, db: forTenant(tenant.id) };
}

export async function makeCustomer(db: ReturnType<typeof forTenant>, name = "Cliente Teste") {
  return db.customer.create({ data: { name, phone: "+5565999990000" } as never });
}
