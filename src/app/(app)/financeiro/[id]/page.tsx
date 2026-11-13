import Link from "next/link";
import { notFound } from "next/navigation";
import { Decimal } from "decimal.js";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { dateBR, dateTimeBR, money, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { todayDate } from "@/server/finance";
import { cancelTransactionAction, registerPaymentAction } from "@/server/finance-actions";
import { Danger, METHODS } from "../parts";

export const metadata = { title: "Lançamento" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Lancamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { db, tenant } = await requireAuth();
  const t = await db.financialTransaction.findFirst({
    where: { id },
    include: { category: { select: { name: true } }, payments: { orderBy: { paidAt: "asc" } }, serviceOrder: { select: { id: true, orderNumber: true } } },
  });
  if (!t) notFound();
  const customer = t.customerId ? await db.customer.findFirst({ where: { id: t.customerId }, select: { name: true } }) : null;
  const paid = t.payments.reduce((s, p) => s.plus(p.amount.toString()), new Decimal(0));
  const remaining = Decimal.max(new Decimal(t.amount.toString()).minus(paid), 0);
  const income = t.type === "INCOME";
  const late = t.status === "PENDING" && t.dueDate < todayDate(tenant.timezone);
  const status = t.status === "PAID" ? ["chip chip-ok", "Pago"] : t.status === "CANCELED" ? ["chip chip-bad", "Cancelado"] : late ? ["chip chip-bad", "Vencida"] : ["chip chip-warn", "Pendente"];

  return (
    <>
      <PageHeader title={t.description} sub={income ? "Receita" : "Despesa"} action={<span className={status[0]}>{status[1]}</span>} />
      <Link href="/financeiro" className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]">Voltar ao financeiro</Link>

      <dl className="card overflow-hidden">
        <Info k="Valor" v={money(t.amount)} strong />
        <Info k={income ? "Recebido" : "Pago"} v={money(paid)} />
        {t.status === "PENDING" && <Info k="Saldo em aberto" v={money(remaining)} strong />}
        <Info k="Categoria" v={t.category.name} />
        <Info k="Vencimento" v={dateBR(t.dueDate, "UTC")} />
        {customer && <Info k="Cliente" v={customer.name} />}
        {t.serviceOrder && <Info k="Ordem de serviço" v={<Link href={`/ordens/${t.serviceOrder.id}`} className="font-semibold text-[var(--accent)] underline underline-offset-2">{t.serviceOrder.orderNumber}</Link>} />}
        {t.paymentMethod && <Info k="Forma de pagamento" v={t.paymentMethod} />}
      </dl>

      {t.status === "PENDING" && (
        <section aria-labelledby="pagar" className="card card-pad mt-6">
          <h2 id="pagar" className="mb-3">{income ? "Registrar recebimento" : "Registrar pagamento"}</h2>
          <ActionForm action={registerPaymentAction} onSuccessHref="/financeiro">
            <input type="hidden" name="id" value={t.id} />
            <Field name="amount" label="Valor (R$)" hint="Pode ser parcial. O saldo continua em aberto."><Input name="amount" required inputMode="decimal" defaultValue={remaining.toFixed(2).replace(".", ",")} /></Field>
            <Field name="method" label="Forma de pagamento">
              <Select name="method" defaultValue={t.paymentMethod ?? ""}><option value="">Não informar</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
            </Field>
            <SubmitButton pendingText="Registrando…">Registrar pagamento</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section aria-labelledby="hist" className="mt-6">
        <h2 id="hist" className="mb-2">Histórico de pagamentos</h2>
        {t.payments.length === 0 ? (
          <p className="card card-pad text-[var(--text-2)]">Nenhum pagamento registrado.</p>
        ) : (
          <ul className="card overflow-hidden">
            {t.payments.map((p) => (
              <li key={p.id} className="list-row">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.method ?? "Sem forma informada"}</span>
                  <span className="block text-sm text-[var(--text-2)]">{dateTimeBR(p.paidAt, tenant.timezone)}</span>
                </span>
                <span className={`num font-semibold ${p.amount.lt(0) ? "text-[var(--bad)]" : ""}`}>{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {t.status !== "CANCELED" && (
        <div className="mt-6">
          <Danger label="Cancelar lançamento" warning={paid.gt(0) ? "O lançamento sai dos totais e o valor já pago é estornado. O histórico de pagamentos é mantido." : "O lançamento sai dos totais. O histórico é mantido."}>
            <ActionForm action={cancelTransactionAction} onSuccessHref="/financeiro">
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton className="btn btn-danger" pendingText="Cancelando…">Confirmar cancelamento</SubmitButton>
            </ActionForm>
          </Danger>
        </div>
      )}
    </>
  );
}

function Info({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="list-row justify-between">
      <dt className="text-[var(--text-2)]">{k}</dt>
      <dd className={`num text-right ${strong ? "text-lg font-semibold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
