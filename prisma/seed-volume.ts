/**
 * Enche a conta demo com bastante informação para testar o sistema com volume.
 * Só desenvolvimento. Roda uma vez: se a demo já tiver muitos clientes, não faz nada.
 *   npm run db:seed:volume
 */
import "dotenv/config";
import { forTenant, prisma } from "../src/lib/db";
import { approveQuote, rejectQuote, saveQuote, sendQuote } from "../src/server/quotes";
import { createTransaction, registerPayment, ensureCategory } from "../src/server/finance";
import type { Line } from "../src/server/line-items";

const DAY = 86_400_000;
let seed = 20261114;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const utcDay = (t: number) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

const FIRST = ["Ana", "Carlos", "Mariana", "João", "Fernanda", "Rafael", "Juliana", "Lucas", "Patrícia", "Bruno", "Camila", "Diego", "Aline", "Thiago", "Larissa", "Gustavo", "Renata", "Felipe", "Vanessa", "Marcelo", "Beatriz", "Rodrigo", "Priscila", "Eduardo", "Tatiane", "Leandro", "Simone", "André", "Débora", "Vinícius"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Ribeiro", "Almeida", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa", "Rocha", "Dias", "Nascimento", "Teixeira", "Moreira", "Cardoso"];
const BUSINESS = ["Mercadinho Bom Preço", "Padaria Pão Quente", "Clínica Sorriso Total", "Escritório Contábil Alvorada", "Farmácia Vida e Saúde", "Auto Peças Rodovia 163", "Salão Espaço Beleza", "Escola Pequenos Passos", "Restaurante Sabor da Terra", "Distribuidora e Atacadista Cuiabá Norte Comércio de Alimentos LTDA"];

const SERVICES: [string, number, number][] = [
  ["Formatação com backup", 40, 120], ["Limpeza interna e troca de pasta térmica", 30, 110], ["Remoção de vírus e otimização", 20, 90],
  ["Instalação do Windows e programas", 30, 100], ["Configuração de rede Wi-Fi", 25, 95], ["Recuperação de dados", 80, 250],
  ["Diagnóstico completo", 0, 60], ["Troca de tela (mão de obra)", 60, 180], ["Manutenção preventiva", 35, 130],
];
const PARTS: [string, number, number][] = [
  ["SSD 480 GB", 210, 320], ["SSD 240 GB", 150, 240], ["Memória RAM 8 GB DDR4", 140, 230], ["Memória RAM 16 GB DDR4", 260, 400],
  ["Fonte 500 W", 160, 260], ["Bateria de notebook", 180, 320], ["Tela 15.6 LED", 380, 590], ["Teclado de notebook", 90, 170],
  ["Cooler de processador", 45, 95], ["Cabo flat de vídeo", 30, 70], ["Placa de vídeo GT 710", 320, 480], ["Roteador Wi-Fi AC1200", 130, 220],
];

const EXPENSES: [string, string, number, number][] = [
  ["Aluguel da bancada", "Aluguel", 450, 450], ["Internet", "Internet", 99, 120], ["Ferramentas (chaves e pinça)", "Ferramentas", 40, 260],
  ["Pasta térmica e álcool isopropílico", "Material", 25, 140], ["Peças para estoque", "Peças", 120, 900], ["Anúncio no Instagram", "Marketing", 50, 300],
  ["Combustível", "Transporte", 60, 220], ["Contador", "Serviços", 180, 180], ["Embalagens e etiquetas", "Material", 20, 90], ["Curso de reparo de placas", "Outros", 150, 600],
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "demo@superheroi.local" }, include: { memberships: true } });
  const tenantId = user?.memberships[0]?.tenantId;
  if (!tenantId) throw new Error("Conta demo não encontrada. Rode `npm run db:seed` antes.");
  const db = forTenant(tenantId);
  if ((await db.customer.count()) > 15) { console.log("A demo já tem volume. Nada a fazer."); return; }
  const now = Date.now();

  // ---- clientes
  const customers: { id: string }[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 44; i++) {
    const biz = i < BUSINESS.length;
    let name = biz ? BUSINESS[i] : `${pick(FIRST)} ${pick(LAST)}${rnd() < 0.3 ? ` ${pick(LAST)}` : ""}`;
    if (i === 12) name = "Maria Aparecida dos Santos Albuquerque de Vasconcelos Filho";
    while (used.has(name)) name += ` ${pick(LAST)}`;
    used.add(name);
    const phone = `+55659${String(int(81000000, 99999999))}`;
    const c = await db.customer.create({
      data: {
        name, phone, whatsapp: rnd() < 0.2 ? `+55659${int(81000000, 99999999)}` : null,
        email: rnd() < 0.55 ? `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}${i}@exemplo.com.br` : null,
        document: biz && i % 2 === 0 ? `${int(10, 99)}${int(100, 999)}${int(100, 999)}000${int(100, 199)}` : null,
        address: rnd() < 0.5 ? { street: `Rua ${pick(LAST)}`, number: String(int(10, 2400)), district: pick(["Centro", "Jardim Tropical", "Boa Esperança", "Santa Rosa", "Coxipó"]), city: "Cuiabá", state: "MT", zip: "78000000" } : undefined,
        notes: i % 7 === 0 ? "Prefere atendimento à tarde. Já pediu desconto por indicação." : null,
        marketingConsent: rnd() < 0.5,
        lastContactAt: new Date(now - int(1, 120) * DAY),
        createdAt: new Date(now - int(20, 200) * DAY),
      } as never,
    });
    customers.push(c);
  }

  // ---- orçamentos
  const line = (kind: Line["kind"], d: string, cost: number, price: number, qty = 1): Line =>
    ({ kind, description: d, quantity: String(qty), unitCost: cost.toFixed(2), unitPrice: price.toFixed(2) });
  const mkItems = (): Line[] => {
    const out: Line[] = [];
    const s = pick(SERVICES); out.push(line("LABOR", s[0], s[1], s[2]));
    if (rnd() < 0.55) { const p = pick(PARTS); out.push(line("PART", p[0], p[1], p[2], rnd() < 0.15 ? 2 : 1)); }
    if (rnd() < 0.2) { const p = pick(PARTS); out.push(line("PART", p[0], p[1], p[2])); }
    if (rnd() < 0.15) { const s2 = pick(SERVICES); out.push(line("OTHER", s2[0], s2[1], s2[2])); }
    return out;
  };

  let approved = 0, paidFull = 0, partial = 0, pending = 0;
  for (const c of customers) {
    const n = rnd() < 0.2 ? 0 : int(1, 4);
    for (let k = 0; k < n; k++) {
      const ago = int(0, 110);
      const when = now - ago * DAY;
      const uberMode = pick(["INCLUDED", "SEPARATE", "SEPARATE", "ABSORBED"] as const);
      const { quote } = await saveQuote(db, tenantId, null, {
        customerId: c.id, items: mkItems(), discount: rnd() < 0.2 ? String(int(1, 4) * 10) : "0", extraFee: "0",
        uberMode, uberCost: String(int(12, 45)), uberMarkup: false,
        validUntil: new Date(when + 15 * DAY), executionDays: int(1, 7),
        paymentTerms: pick(["Pix na entrega", "Cartão em até 3x", "Metade agora, metade na entrega", "À vista"]),
        warranty: pick(["90 dias nas peças e no serviço", "30 dias", "6 meses nas peças"]),
        notes: rnd() < 0.5 ? pick([
          "Equipamento chegou com a tela trincada e sem bateria. O valor já inclui a limpeza completa.",
          "Fiz o teste de memória e o disco estava com setores ruins. Recomendo trocar por SSD para o computador voltar a ficar rápido.",
          "Se o cliente aprovar hoje, consigo entregar amanhã até às 18h.",
          "Serviço feito no local. Inclui deslocamento e configuração do roteador.",
        ]) : undefined,
      } as never);
      const roll = rnd();
      const stamp = { createdAt: new Date(when) };
      if (roll < 0.62) {
        await approveQuote(db, quote.id, pick(["WhatsApp", "Presencial", "Pix"]));
        approved++;
        const decided = new Date(when + int(0, 2) * DAY);
        await db.quote.update({ where: { id: quote.id }, data: { ...stamp, decidedAt: decided, sentAt: new Date(when) } });
        const txs = await db.financialTransaction.findMany({ where: { quoteId: quote.id } });
        for (const t of txs) await db.financialTransaction.update({ where: { id: t.id }, data: { dueDate: utcDay(decided.getTime() + int(0, 6) * DAY), createdAt: decided } });
        const income = txs.filter((t) => t.type === "INCOME");
        const expense = txs.filter((t) => t.type === "EXPENSE");
        const mode = rnd();
        for (const t of income) {
          const amt = Number(t.amount);
          const payAt = new Date(decided.getTime() + int(0, 3) * DAY);
          if (mode < 0.55 && payAt.getTime() <= now) { await registerPayment(db, t.id, { amount: amt, method: pick(["PIX", "Dinheiro", "Cartão de crédito", "Cartão de débito"]), paidAt: payAt }); paidFull++; }
          else if (mode < 0.7 && amt > 20 && payAt.getTime() <= now) { await registerPayment(db, t.id, { amount: Math.round(amt * 0.4 * 100) / 100, method: "PIX", paidAt: payAt }); partial++; }
          else pending++;
        }
        for (const t of expense) if (rnd() < 0.8 && decided.getTime() <= now) await registerPayment(db, t.id, { amount: Number(t.amount), method: "PIX", paidAt: decided });
      } else if (roll < 0.78) {
        await sendQuote(db, quote.id);
        await db.quote.update({ where: { id: quote.id }, data: { ...stamp, sentAt: new Date(when) } });
      } else if (roll < 0.9) {
        await db.quote.update({ where: { id: quote.id }, data: stamp });
      } else {
        await rejectQuote(db, quote.id);
        await db.quote.update({ where: { id: quote.id }, data: { ...stamp, decidedAt: new Date(when + DAY) } });
      }
    }
  }

  // ---- despesas avulsas
  let exp = 0;
  for (let i = 0; i < 38; i++) {
    const [desc, cat, lo, hi] = pick(EXPENSES);
    const category = await ensureCategory(db, cat, "EXPENSE");
    const ago = int(-12, 105); // negativo = vence no futuro
    const due = utcDay(now - ago * DAY);
    const t = await createTransaction(db, { type: "EXPENSE", description: `${desc}${i % 5 === 0 ? ` (${int(1, 12)}/12)` : ""}`, categoryId: category.id, amount: int(lo, hi), dueDate: due, paymentMethod: pick(["PIX", "Cartão de crédito", "Boleto", "Dinheiro"]) });
    if (ago > 3 && rnd() < 0.8) await registerPayment(db, t.id, { amount: Number(t.amount), method: "PIX", paidAt: new Date(due.getTime() + 12 * 3_600_000) });
    exp++;
  }

  console.log(`Volume criado: ${customers.length} clientes, ${approved} orçamentos aprovados (${paidFull} pagos, ${partial} parciais, ${pending} pendentes), ${exp} despesas.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
