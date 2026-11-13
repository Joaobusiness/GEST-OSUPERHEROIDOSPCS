import "dotenv/config";
import { prisma } from "../src/lib/db";
async function main() {
  const t = await prisma.tenant.findFirst({ where: { email: "demo@superheroi.local" } });
  const tx = await prisma.financialTransaction.findMany({ where: { tenantId: t!.id }, select: { type: true, status: true, amount: true, description: true, allocationKey: true } });
  const q = await prisma.quote.findMany({ where: { tenantId: t!.id }, select: { number: true, status: true, totalAmount: true, totalCost: true } });
  console.log(JSON.stringify({ q, tx }, null, 1));
}
main().finally(() => prisma.$disconnect());
