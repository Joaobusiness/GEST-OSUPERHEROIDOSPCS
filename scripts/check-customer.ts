import "dotenv/config";
import { prisma } from "../src/lib/db";
async function main() {
  console.log(JSON.stringify(await prisma.customer.findMany({ where: { name: "Roberto Teste" }, select: { name: true, phone: true, marketingConsent: true, marketingOptOut: true } })));
}
main().finally(() => prisma.$disconnect());
