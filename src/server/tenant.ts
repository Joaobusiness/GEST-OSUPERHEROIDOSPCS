import type { Prisma } from "@/generated/prisma/client";

const CATEGORIES: [string, "INCOME" | "EXPENSE"][] = [
  ["Serviços", "INCOME"], ["Peças", "INCOME"], ["Deslocamento (repasse)", "INCOME"], ["Outras receitas", "INCOME"],
  ["Peças e insumos", "EXPENSE"], ["Transporte / Uber", "EXPENSE"], ["Ferramentas", "EXPENSE"],
  ["Impostos e taxas", "EXPENSE"], ["Outras despesas", "EXPENSE"],
];

export const DEFAULT_TEMPLATES = [
  { name: "Retorno após atendimento", kind: "OPERATIONAL" as const, body: "Olá, {nome_cliente}! Aqui é da {nome_empresa}. Tudo certo com o seu equipamento após o atendimento de {data_atendimento} ({ultimo_servico})? Qualquer coisa, é só chamar: {telefone_empresa}." },
  { name: "Cliente sem atendimento", kind: "MARKETING" as const, body: "Olá, {nome_cliente}! Tudo bem? Aqui é da {nome_empresa}. Faz um tempo desde o último atendimento ({ultimo_servico}, {data_atendimento}). Quer que eu dê uma olhada no seu computador? {telefone_empresa}" },
  { name: "Orçamento pendente", kind: "OPERATIONAL" as const, body: "Olá, {nome_cliente}! Passando para saber se você conseguiu ver o orçamento que enviei. Posso tirar alguma dúvida? {nome_empresa} - {telefone_empresa}" },
];

/** Creates everything a new tenant needs. Runs inside the caller's transaction. */
export async function bootstrapTenant(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.pricingSettings.create({ data: { tenantId } });
  await tx.financialCategory.createMany({ data: CATEGORIES.map(([name, type]) => ({ tenantId, name, type })) });
  await tx.communicationTemplate.createMany({ data: DEFAULT_TEMPLATES.map((t) => ({ ...t, tenantId })) });
  const plan = (await tx.subscriptionPlan.findFirst({ where: { isActive: true } })) ??
    (await tx.subscriptionPlan.create({ data: { name: "Plano Único", description: "Preço a definir pelo administrador.", price: 0 } }));
  await tx.subscription.create({ data: { tenantId, planId: plan.id, status: "TRIAL" } });
}
