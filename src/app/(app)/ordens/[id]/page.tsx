import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { OS_STATUS, PageHeader, QUOTE_STATUS, Status, dateBR, dateTimeBR, money } from "@/components/ui";
import { uuid } from "@/lib/action";
import { requireAuth } from "@/server/auth";
import { orderFinance, type FinanceState } from "@/server/orders";
import { changeStatusAction, orderToQuoteAction, reopenAction, saveDetailsAction } from "@/server/orders-actions";
import { OrderItemsForm } from "../order-items-form";

const FIN: Record<FinanceState, { label: string; tone: string }> = {
  NONE: { label: "Sem cobrança", tone: "chip" }, PENDING: { label: "Pendente", tone: "chip chip-warn" },
  PARTIAL: { label: "Parcial", tone: "chip chip-warn" }, PAID: { label: "Pago", tone: "chip chip-ok" },
};
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db, tenant } = await requireAuth();
  const o = await db.serviceOrder.findFirst({
    where: { id },
    include: { customer: true, device: true, items: { orderBy: { id: "asc" } }, history: { orderBy: { createdAt: "desc" } }, quotes: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) notFound();
  const [fin, users] = await Promise.all([
    orderFinance(db, id),
    db.user.findMany({ where: { id: { in: o.history.flatMap((h) => (h.userId ? [h.userId] : [])) } }, select: { id: true, name: true } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const closed = o.status === "DELIVERED" || o.status === "CANCELED";
  const tz = tenant.timezone;
  const device = [o.device?.category, o.device?.brand, o.device?.model].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader title={o.orderNumber} sub={o.customer.name} action={<Status map={OS_STATUS} value={o.status} />} />
      <div className="grid gap-5">
        <section className="card card-pad grid gap-3" aria-label="Resumo">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.9375rem]">
            <div><dt className="hint">Cliente</dt><dd className="font-medium"><Link href={`/clientes/${o.customerId}`} className="text-[var(--accent)] underline underline-offset-2">{o.customer.name}</Link></dd></div>
            <div><dt className="hint">Equipamento</dt><dd className="font-medium">{device || "Não informado"}</dd></div>
            <div><dt className="hint">Aberta em</dt><dd className="font-medium">{dateBR(o.createdAt, tz)}</dd></div>
            <div><dt className="hint">Previsão</dt><dd className="font-medium">{dateBR(o.estimatedDeliveryAt, tz)}</dd></div>
            <div><dt className="hint">Concluída em</dt><dd className="font-medium">{dateBR(o.completedAt, tz)}</dd></div>
            <div><dt className="hint">Entregue em</dt><dd className="font-medium">{dateBR(o.deliveredAt, tz)}</dd></div>
          </dl>
          <p className="border-t border-[var(--line)] pt-3 text-[0.9375rem] text-[var(--text-2)]">{o.description}</p>
        </section>

        <section className="card card-pad grid gap-3" aria-labelledby="st">
          <h2 id="st">{closed ? "Reabrir OS" : "Mudar status"}</h2>
          {closed ? (
            <ActionForm action={reopenAction}>
              <input type="hidden" name="id" value={id} />
              <Field name="note" label="Motivo" hint="Fica registrado no histórico."><Textarea name="note" /></Field>
              <SubmitButton className="btn btn-quiet">Reabrir OS</SubmitButton>
            </ActionForm>
          ) : (
            <ActionForm action={changeStatusAction}>
              <input type="hidden" name="id" value={id} />
              <Field name="status" label="Novo status">
                <Select name="status" defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {Object.entries(OS_STATUS).filter(([k]) => k !== o.status).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field name="note" label="Observação (opcional)"><Input name="note" maxLength={500} /></Field>
              <SubmitButton>Atualizar status</SubmitButton>
            </ActionForm>
          )}
        </section>

        <section className="card card-pad grid gap-3" aria-labelledby="dt">
          <h2 id="dt">Diagnóstico e observações</h2>
          <ActionForm action={saveDetailsAction}>
            <input type="hidden" name="id" value={id} />
            <Field name="description" label="Problema relatado"><Textarea name="description" defaultValue={o.description} readOnly={closed} /></Field>
            <Field name="diagnosis" label="Diagnóstico"><Textarea name="diagnosis" defaultValue={o.diagnosis ?? ""} readOnly={closed} /></Field>
            <Field name="notes" label="Notas técnicas"><Textarea name="notes" defaultValue={o.notes ?? ""} readOnly={closed} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="warrantyDays" label="Garantia (dias)"><Input name="warrantyDays" inputMode="numeric" defaultValue={o.warrantyDays} readOnly={closed} /></Field>
              <Field name="estimatedDeliveryAt" label="Previsão de entrega"><Input type="date" name="estimatedDeliveryAt" defaultValue={isoDay(o.estimatedDeliveryAt)} readOnly={closed} /></Field>
            </div>
            {!closed && <SubmitButton>Salvar</SubmitButton>}
          </ActionForm>
        </section>

        <section className="card card-pad grid gap-3" aria-labelledby="it">
          <h2 id="it">Itens e valores</h2>
          <OrderItemsForm id={id} locked={closed} initial={o.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity.toString(), unitCost: i.unitCost.toString(), unitPrice: i.unitPrice.toString() }))} />
        </section>

        <section className="card card-pad grid gap-3" aria-labelledby="fn">
          <div className="flex items-center justify-between gap-3"><h2 id="fn">Financeiro</h2><span className={FIN[fin.state].tone}>{FIN[fin.state].label}</span></div>
          <p className="hint">O pagamento é independente do status da OS.</p>
          <dl className="grid grid-cols-3 gap-3 text-[0.9375rem]">
            <div><dt className="hint">A receber</dt><dd className="num font-semibold">{money(fin.total)}</dd></div>
            <div><dt className="hint">Recebido</dt><dd className="num font-semibold text-[var(--ok)]">{money(fin.paid)}</dd></div>
            <div><dt className="hint">Em aberto</dt><dd className="num font-semibold">{money(fin.open)}</dd></div>
          </dl>
          {fin.state === "NONE" && <p className="text-[0.9375rem] text-[var(--text-2)]">A cobrança é criada quando o orçamento é aprovado ou a OS é entregue.</p>}
          <Link href="/financeiro" className="btn btn-quiet btn-sm justify-self-start">Abrir financeiro</Link>
        </section>

        <section className="card card-pad grid gap-3" aria-labelledby="qt">
          <h2 id="qt">Orçamentos</h2>
          {o.quotes.length > 0 && (
            <ul>
              {o.quotes.map((q) => (
                <li key={q.id}><Link href={`/orcamentos/${q.id}`} className="list-row !px-0">
                  <span className="flex-1 font-medium"><span className="num">{q.number}</span> <span className="text-[var(--text-2)]">rev. {q.revision}</span></span>
                  <Status map={QUOTE_STATUS} value={q.status} /><span className="num font-semibold">{money(q.totalAmount)}</span>
                </Link></li>
              ))}
            </ul>
          )}
          <form action={orderToQuoteAction}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-quiet w-full"><FileText size={18} aria-hidden /> Orçamento desta OS</button>
          </form>
        </section>

        <section className="card card-pad" aria-labelledby="hs">
          <h2 id="hs" className="mb-3">Histórico</h2>
          <ol>
            {o.history.map((h) => (
              <li key={h.id} className="grid gap-0.5 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0">
                <p className="font-medium">{h.fromStatus ? `${OS_STATUS[h.fromStatus].label} para ${OS_STATUS[h.toStatus].label}` : OS_STATUS[h.toStatus].label}</p>
                {h.note && <p className="text-[0.9375rem] text-[var(--text-2)]">{h.note}</p>}
                <p className="text-sm text-[var(--text-3)]">{dateTimeBR(h.createdAt, tz)}{h.userId && who.get(h.userId) ? `, ${who.get(h.userId)}` : ""}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
