import { requireSuperAdmin } from "@/server/auth";
import { Empty, PageHeader, money } from "@/components/ui";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { savePlanAction, setPlanActiveAction } from "@/server/admin-actions";
import { ConfirmButton } from "../confirm-button";

export const metadata = { title: "Planos" };

function PlanFields({ p }: { p?: { id: string; name: string; description: string | null; price: { toString(): string }; billingCycle: string } }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field name="name" label="Nome"><Input name="name" defaultValue={p?.name} required /></Field>
      <Field name="description" label="Descrição"><Input name="description" defaultValue={p?.description ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field name="price" label="Preço (R$)"><Input name="price" inputMode="decimal" defaultValue={p?.price.toString() ?? ""} required /></Field>
        <Field name="billingCycle" label="Ciclo">
          <Select name="billingCycle" defaultValue={p?.billingCycle ?? "MONTHLY"}><option value="MONTHLY">Mensal</option><option value="YEARLY">Anual</option></Select>
        </Field>
      </div>
      <SubmitButton>{p ? "Salvar plano" : "Criar plano"}</SubmitButton>
    </>
  );
}

export default async function Page() {
  await requireSuperAdmin(); // the layout check alone is not enough: pages and actions can be reached without it
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Planos" sub="Alterar o preço não muda assinaturas já registradas, só o valor usado nos indicadores." />
      <div className="grid gap-6">
        {plans.length === 0 && <Empty title="Nenhum plano" text="Crie o primeiro plano abaixo." />}
        {plans.length > 0 && (
          <ul className="card min-w-0 divide-y divide-[var(--line)]">
            {plans.map((p) => (
              <li key={p.id}>
                <details>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="num block text-sm text-[var(--text-2)]">{money(p.price)} / {p.billingCycle === "YEARLY" ? "ano" : "mês"}</span>
                    </span>
                    <span className={p.isActive ? "chip chip-ok" : "chip"}>{p.isActive ? "Ativo" : "Inativo"}</span>
                  </summary>
                  <div className="grid gap-3 border-t border-[var(--line)] p-4">
                    <ActionForm action={savePlanAction}><PlanFields p={p} /></ActionForm>
                    <ActionForm action={setPlanActiveAction}>
                      <input type="hidden" name="planId" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.isActive)} />
                      {p.isActive
                        ? <ConfirmButton message={`Desativar ${p.name}? Novas empresas deixam de receber este plano.`}>Desativar plano</ConfirmButton>
                        : <SubmitButton className="btn btn-quiet btn-sm" pendingText="Ativando…">Ativar plano</SubmitButton>}
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <section className="card card-pad grid gap-3">
          <h2>Novo plano</h2>
          <ActionForm action={savePlanAction} resetOnSuccess><PlanFields /></ActionForm>
        </section>
      </div>
    </>
  );
}
