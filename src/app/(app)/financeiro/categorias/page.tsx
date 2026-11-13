import Link from "next/link";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/server/finance-actions";
import { Danger } from "../parts";

export const metadata = { title: "Categorias" };

export default async function Categorias() {
  const { db } = await requireAuth();
  const [cats, used] = await Promise.all([
    db.financialCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.financialTransaction.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);
  const count = new Map(used.map((u) => [u.categoryId, u._count._all]));

  return (
    <>
      <PageHeader title="Categorias" sub="Agrupam receitas e despesas nos relatórios." />
      <Link href="/financeiro" className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]">Voltar ao financeiro</Link>

      <div className="card card-pad mb-6">
        <h2 className="mb-3">Nova categoria</h2>
        <ActionForm action={createCategoryAction} resetOnSuccess>
          <Field name="name" label="Nome"><Input name="name" required maxLength={60} /></Field>
          <Field name="type" label="Tipo"><Select name="type" defaultValue="EXPENSE"><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></Select></Field>
          <SubmitButton>Criar categoria</SubmitButton>
        </ActionForm>
      </div>

      {(["INCOME", "EXPENSE"] as const).map((type) => (
        <section key={type} aria-labelledby={type} className="mb-6">
          <h2 id={type} className="mb-2">{type === "INCOME" ? "Receitas" : "Despesas"}</h2>
          <ul className="card overflow-hidden">
            {cats.filter((c) => c.type === type).map((c) => (
              <li key={c.id} className="grid gap-3 p-4 [&+li]:border-t [&+li]:border-[var(--line)]">
                <ActionForm action={renameCategoryAction} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="min-w-0 flex-1">
                    <Field name="name" label="Nome" hint={`${count.get(c.id) ?? 0} lançamento(s)`}><Input name="name" defaultValue={c.name} required maxLength={60} /></Field>
                  </div>
                  <SubmitButton className="btn btn-quiet" pendingText="Salvando…">Renomear</SubmitButton>
                </ActionForm>
                {!count.get(c.id) && (
                  <Danger label="Excluir categoria" warning="A categoria é removida. Só é possível porque ela não tem lançamentos.">
                    <ActionForm action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn btn-danger" pendingText="Excluindo…">Confirmar exclusão</SubmitButton>
                    </ActionForm>
                  </Danger>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
