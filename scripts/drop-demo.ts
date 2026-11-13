// Removes only the seeded demo tenant (dev convenience). Never touches other tenants.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
const t = await prisma.tenant.findFirst({ where: { email: "demo@superheroi.local" } });
if (!t) { console.log("sem demo"); return; }
const w = { where: { tenantId: t.id } };
await prisma.$transaction([
  prisma.campaignContact.deleteMany(w), prisma.campaign.deleteMany(w), prisma.customerInteraction.deleteMany(w),
  prisma.transactionPayment.deleteMany(w), prisma.financialTransaction.deleteMany(w), prisma.financialCategory.deleteMany(w),
  prisma.quoteItem.deleteMany(w), prisma.quote.deleteMany(w),
  prisma.serviceOrderStatusLog.deleteMany(w), prisma.serviceOrderItem.deleteMany(w), prisma.serviceOrder.deleteMany(w),
  prisma.customerDevice.deleteMany(w), prisma.customer.deleteMany(w),
  prisma.communicationTemplate.deleteMany(w), prisma.pricingSimulation.deleteMany(w), prisma.pricingSettings.deleteMany(w),
  prisma.auditLog.deleteMany(w), prisma.session.deleteMany({ where: { tenantId: t.id } }),
  prisma.tenant.delete({ where: { id: t.id } }),
  prisma.user.deleteMany({ where: { email: "demo@superheroi.local" } }),
]);
console.log("demo removida");
}
main().finally(() => prisma.$disconnect());
