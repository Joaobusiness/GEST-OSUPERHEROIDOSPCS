import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { ActionForm, Field, Select, SubmitButton } from "@/components/form";
import { PageHeader, QUOTE_STATUS, Status, dateBR, money } from "@/components/ui";
import { uuid } from "@/lib/action";
import { whatsappLink } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { dec, uberCharge } from "@/server/line-items";
import { approveAction, cancelAction, rejectAction } from "@/server/quotes-actions";
import { ConfirmButton } from "../../clientes/confirm-button";
import { WhatsAppButton } from "../share-buttons";
import { draftKey } from "../draft";
import { DraftCleared } from "../draft-cleared";

const KIND = { PART: "Peça", LABOR: "Mão de obra", OTHER: "Outro" };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rev?: string; salvo?: string }> }) {
  const { id } = await params;
  const { rev, salvo } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const { db, tenant, tenantId, user } = await requireAuth();
  const q = await db.quote.findFirst({ where: { id }, include: { customer: true, items: { orderBy: { id: "asc" } } } });
  if (!q) notFound();
  const revisions = await db.quote.findMany({ where: { number: q.number }, orderBy: { revision: "desc" }, select: { id: true, revision: true, status: true } });
  const tz = tenant.timezone;
  const uber = uberCharge(q, q);
  const open = q.status === "DRAFT" || q.status === "SENT";

  const msg = [
    `Olá, ${q.customer.name.split(" ")[0]}! Segue o orçamento ${q.number} da ${tenant.name}:`,
    ...q.items.slice(0, 10).map((i) => `- ${i.description}: ${money(dec(i.quantity.toString()).times(i.unitPrice.toString()))}`),
    ...(uber.gt(0) ? [`- Deslocamento: ${money(uber)}`] : []),
    ...(q.discount.gt(0) ? [`Desconto: ${money(q.discount)}`] : []),
    `Total: ${money(q.totalAmount)}`,
    ...(q.validUntil ? [`Válido até ${dateBR(q.validUntil, tz)}.`] : []),
    ...(q.paymentTerms ? [`Pagamento: ${q.paymentTerms}`] : []),
    ...(q.warranty ? [`Garantia: ${q.warranty}`] : []),
    "Posso seguir com o serviço?",
  ].join("\n");
  const wa = whatsappLink(q.customer.whatsapp || q.customer.phone, msg);

  return (
    <>
      <PageHeader title={q.number} sub={`${q.customer.name}, revisão ${q.revision}`} action={<Status map={QUOTE_STATUS} value={q.status} />} />
      {salvo && (salvo === "novo" || uuid.safeParse(salvo).success) && <DraftCleared draftKey={draftKey(tenantId, user.id, salvo === "novo" ? undefined : salvo)} href={`/orcamentos/${q.id}${rev ? "?rev=1" : ""}`} />}
      {rev && <p role="status" className="chip chip-ok !mb-4 !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">Nova revisão criada. A anterior foi preservada.</p>}
      <div className="grid gap-5">
        <section className="card card-pad grid gap-3" aria-label="Itens">
          <ul>
            {q.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0"><p className="font-medium">{i.description}</p><p className="text-sm text-[var(--text-2)]">{KIND[i.kind]}, {i.quantity.toString()} x {money(i.unitPrice)}</p></div>
                <p className="num shrink-0 font-semibold">{money(dec(i.quantity.toString()).times(i.unitPrice.toString()).toDecimalPlaces(2))}</p>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1.5 border-t border-[var(--line)] pt-3 text-[0.9375rem]">
            {uber.gt(0) && <div className="flex justify-between"><dt className="text-[var(--text-2)]">Deslocamento</dt><dd className="num font-semibold">{money(uber)}</dd></div>}
            {q.discount.gt(0) && <div className="flex justify-between"><dt className="text-[var(--text-2)]">Desconto</dt><dd className="num font-semibold">- {money(q.discount)}</dd></div>}
            {q.extraFee.gt(0) && <div className="flex justify-between"><dt className="text-[var(--text-2)]">Taxa extra</dt><dd className="num font-semibold">{money(q.extraFee)}</dd></div>}
            <div className="flex items-baseline justify-between pt-1"><dt className="font-semibold">Total</dt><dd className="num text-2xl font-bold">{money(q.totalAmount)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-2)]">Custo total</dt><dd className="num">{money(q.totalCost)}</dd></div>
          </dl>
        </section>

        <section className="card card-pad grid gap-2 text-[0.9375rem]" aria-label="Condições">
          <p><span className="text-[var(--text-2)]">Válido até:</span> {dateBR(q.validUntil, tz)}</p>
          {q.executionDays != null && <p><span className="text-[var(--text-2)]">Prazo:</span> {q.executionDays} dias</p>}
          {q.paymentTerms && <p><span className="text-[var(--text-2)]">Pagamento:</span> {q.paymentTerms}</p>}
          {q.warranty && <p><span className="text-[var(--text-2)]">Garantia:</span> {q.warranty}</p>}
          {q.notes && <p><span className="text-[var(--text-2)]">Explicação:</span> {q.notes}</p>}
          {q.decidedAt && <p><span className="text-[var(--text-2)]">Decidido em:</span> {dateBR(q.decidedAt, tz)}{q.approvalMethod ? `, ${q.approvalMethod}` : ""}</p>}
        </section>

        <section className="card card-pad grid gap-3" aria-label="Ações">
          {q.status !== "CANCELED" && <WhatsAppButton href={wa} quoteId={q.id} markSent={q.status === "DRAFT"} />}
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/orcamentos/${q.id}/imprimir`} className="btn btn-quiet"><FileDown size={18} aria-hidden /> PDF</Link>
            {q.status !== "CANCELED" && <Link href={`/orcamentos/${q.id}/editar`} className="btn btn-quiet"><Pencil size={18} aria-hidden /> {open ? "Editar" : "Nova revisão"}</Link>}
          </div>
          {open && (
            <ActionForm action={approveAction} className="grid gap-3 border-t border-[var(--line)] pt-4">
              <input type="hidden" name="id" value={q.id} />
              <Field name="method" label="Aprovado como">
                <Select name="method" defaultValue="WhatsApp"><option>WhatsApp</option><option>Presencial</option><option>Telefone</option><option>Manual</option></Select>
              </Field>
              <SubmitButton>Registrar aprovação</SubmitButton>
            </ActionForm>
          )}
          <div className="grid grid-cols-2 gap-3">
            {open && <ActionForm action={rejectAction}><input type="hidden" name="id" value={q.id} /><SubmitButton className="btn btn-quiet w-full">Marcar recusado</SubmitButton></ActionForm>}
            {(open || q.status === "APPROVED") && <ActionForm action={cancelAction}><input type="hidden" name="id" value={q.id} /><ConfirmButton message="Cancelar este orçamento? Os valores a receber ligados a ele também serão cancelados." className="btn btn-danger w-full">Cancelar orçamento</ConfirmButton></ActionForm>}
          </div>
        </section>

        {revisions.length > 1 && (
          <section className="card card-pad" aria-label="Revisões">
            <h2 className="mb-2">Revisões</h2>
            <ul>{revisions.map((r) => (
              <li key={r.id}><Link href={`/orcamentos/${r.id}`} className="list-row !px-0"><span className="flex-1 font-medium">Revisão {r.revision}{r.id === q.id ? " (esta)" : ""}</span><Status map={QUOTE_STATUS} value={r.status} /></Link></li>
            ))}</ul>
          </section>
        )}
      </div>
    </>
  );
}
