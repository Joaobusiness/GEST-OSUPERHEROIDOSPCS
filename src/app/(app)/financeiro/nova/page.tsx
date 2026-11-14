import Link from "next/link";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { resolvePeriod } from "@/server/finance";
import { createTransactionAction } from "@/server/finance-actions";
import { chipOff, chipOn, first, METHODS, type SP } from "../parts";

export const metadata = { title: "Novo lançamento" };

export default async function NovoLancamento({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, tenant } = await requireAuth();
  const sp = await searchParams;
  const type = first(sp.tipo) === "EXPENSE" ? "EXPENSE" : "INCOME";
  const [categories, customers] = await Promise.all([
    db.financialCategory.findMany({ where: { type }, orderBy: { name: "asc" } }),
    db.customer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, take: 300, select: { id: true, name: true } }),
  ]);
  const today = resolvePeriod({ p: "hoje" }, tenant.timezone).from;

  return (
    <>
      <PageHeader title="Novo lançamento" sub="Registre uma receita ou despesa. O pagamento você marca depois." />
      <div className="mb-4 flex gap-2">
        <Link href="/financeiro/nova?tipo=INCOME" className={type === "INCOME" ? chipOn : chipOff}>Receita</Link>
        <Link href="/financeiro/nova?tipo=EXPENSE" className={type === "EXPENSE" ? chipOn : chipOff}>Despesa</Link>
      </div>
      <div className="card card-pad">
        <ActionForm action={createTransactionAction} onSuccessHref="/financeiro">
          <input type="hidden" name="type" value={type} />
          <Field name="description" label="Descrição"><Input name="description" required maxLength={200} placeholder={type === "INCOME" ? "Ex.: Formatação, notebook do João" : "Ex.: SSD 240 GB"} /></Field>
          <Field name="amount" label="Valor (R$)"><Input name="amount" required inputMode="decimal" placeholder="0,00" /></Field>
          <Field name="dueDate" label="Vencimento"><Input name="dueDate" type="date" required defaultValue={today} /></Field>
          <Field name="categoryId" label="Categoria">
            <Select name="categoryId" required defaultValue="">
              <option value="" disabled>Escolha</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field name="customerId" label="Cliente (opcional)">
            <Select name="customerId" defaultValue=""><option value="">Sem cliente</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
          <Field name="paymentMethod" label="Forma de pagamento (opcional)">
            <Select name="paymentMethod" defaultValue=""><option value="">Não definida</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
          <SubmitButton>Salvar lançamento</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
