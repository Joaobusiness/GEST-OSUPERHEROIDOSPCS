import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2"; // same call as hashPassword(); auth.ts imports server-only, which fails outside Next
import { prisma } from "../src/lib/db";
import { forTenant } from "../src/lib/db";
import { approveQuote, saveQuote } from "../src/server/quotes";
import { bootstrapTenant } from "../src/server/tenant";

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@superheroi.local").toLowerCase();
// no well-known default: an unset password becomes a random one, printed once
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString("base64url");
const DEMO_EMAIL = "demo@superheroi.local";
const DAY = 86_400_000;

async function main() {
  const prod = process.env.NODE_ENV === "production";
  if (prod && !(process.env.SEED_ADMIN_PASSWORD && process.env.SEED_ADMIN_EMAIL)) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para rodar o seed em produção (o Super Admin é só o seu usuário).");
  // Plan: price 0 on purpose, the real price is still to be defined.
  const plan = (await prisma.subscriptionPlan.findFirst({ where: { name: "Plano Único" } })) ??
    (await prisma.subscriptionPlan.create({ data: { name: "Plano Único", price: 0, description: "Preço a definir pelo administrador da plataforma." } }));

  if (!(await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } }))) {
    await prisma.user.create({ data: { email: ADMIN_EMAIL, name: "Super Admin", passwordHash: await hash(ADMIN_PASSWORD), isSuperAdmin: true } });
    console.log(`Super Admin criado: ${ADMIN_EMAIL}${process.env.SEED_ADMIN_PASSWORD ? "" : ` / ${ADMIN_PASSWORD} (anote: não será mostrada de novo)`}`);
  }

  if (prod) { console.log("Produção: demo não criada."); return; }
  if (await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })) { console.log("Demo já existe. Nada a fazer."); return; }

  let seeded: { tenantId: string; customerId: string } | undefined;
  const passwordHash = await hash("Demo!12345");
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: "Assistência Demo", email: DEMO_EMAIL, phone: "+5565999990001", whatsapp: "+5565999990001", quoteSeq: 0 } });
    const user = await tx.user.create({ data: { email: DEMO_EMAIL, name: "Técnico Demo", passwordHash } });
    await tx.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" } });
    await bootstrapTenant(tx, tenant.id); // reuses the active plan created above
    const tenantId = tenant.id;
    const now = Date.now();

    const mk = (name: string, phone: string, extra: object = {}) => tx.customer.create({ data: { tenantId, name, phone, ...extra } });
    const ana = await mk("Ana Paula Souza", "+5565991110001", { email: "ana@example.com", marketingConsent: true, lastContactAt: new Date(now - 5 * DAY) });
    const carlos = await mk("Carlos Eduardo Lima", "+5565991110002", { lastContactAt: new Date(now - 90 * DAY) });
    const mercado = await mk("Mercadinho Bom Preço", "+5565991110003", { document: "11222333000181", lastContactAt: new Date(now - 20 * DAY) });

    const dev = (customerId: string, category: string, brand: string, model: string) =>
      tx.customerDevice.create({ data: { tenantId, customerId, category, brand, model } });
    await dev(ana.id, "Notebook", "Dell", "Inspiron 15 3000");
    await dev(carlos.id, "Desktop", "Montado", "Ryzen 5 / 16 GB");
    await dev(mercado.id, "Desktop", "Positivo", "Master D3400");

    seeded = { tenantId, customerId: ana.id };
    console.log(`Demo criada: ${DEMO_EMAIL} / Demo!12345 (plano ${plan.name})`);
  });

  // Approved quote goes through the real services, so finance gets its receivable and the uber cost once.
  if (seeded) {
    const db = forTenant(seeded.tenantId);
    const { quote } = await saveQuote(db, seeded.tenantId, null, {
      customerId: seeded.customerId, discount: "0", extraFee: "0",
      uberMode: "SEPARATE", uberCost: "25", uberMarkup: false, warranty: "90 dias", paymentTerms: "Pix ou cartão",
      items: [
        { kind: "PART", description: "SSD 480 GB", quantity: "1", unitCost: "220", unitPrice: "310" },
        { kind: "LABOR", description: "Limpeza, formatação e instalação", quantity: "1", unitCost: "80", unitPrice: "150" },
      ],
    });
    await approveQuote(db, quote.id, "WhatsApp");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
