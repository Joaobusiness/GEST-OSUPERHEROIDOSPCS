import { notFound } from "next/navigation";
import { dateBR, money } from "@/components/ui";
import { uuid } from "@/lib/action";
import { formatPhone } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { dec, uberCharge } from "@/server/line-items";
import { PrintButton } from "../../share-buttons";

export const metadata = { title: "Orçamento" };

// The app shell (bars, tab bar) is hidden on paper; A4 margins come from @page.
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  aside, nav, header { display: none !important; }
  body { background: #fff !important; padding: 0 !important; }
  main { max-width: none !important; padding: 0 !important; }
  .sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
}`;

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db, tenant } = await requireAuth();
  const q = await db.quote.findFirst({ where: { id }, include: { customer: true, items: { orderBy: { id: "asc" } } } });
  if (!q) notFound();
  const tz = tenant.timezone;
  const uber = uberCharge(q, q);
  const contact = [tenant.phone && formatPhone(tenant.phone), tenant.whatsapp && tenant.whatsapp !== tenant.phone ? `WhatsApp ${formatPhone(tenant.whatsapp)}` : null, tenant.email].filter(Boolean).join("  |  ");

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="mb-4 print:hidden"><PrintButton /></div>
      <article className="sheet card card-pad grid gap-6 !bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div className="min-w-0">
            <h1 className="!text-2xl">{tenant.name}</h1>
            {tenant.document && <p className="text-sm text-[var(--text-2)]">{tenant.document}</p>}
            <p className="text-sm text-[var(--text-2)]">{contact}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold">Orçamento {q.number}</p>
            <p className="text-sm text-[var(--text-2)]">Revisão {q.revision}</p>
            <p className="text-sm text-[var(--text-2)]">{dateBR(q.createdAt, tz)}</p>
          </div>
        </div>

        <div className="text-[0.9375rem]">
          <p className="hint">Cliente</p>
          <p className="font-semibold">{q.customer.name}</p>
          <p className="text-[var(--text-2)]">{formatPhone(q.customer.whatsapp || q.customer.phone)}{q.customer.email ? `  |  ${q.customer.email}` : ""}</p>
        </div>

        <table className="w-full text-left text-[0.9375rem]">
          <thead><tr className="border-b border-[var(--line)] text-sm text-[var(--text-2)]">
            <th className="py-2 pr-2 font-semibold">Descrição</th><th className="px-2 text-right font-semibold">Qtd.</th><th className="px-2 text-right font-semibold">Unitário</th><th className="pl-2 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>
            {q.items.map((i) => (
              <tr key={i.id} className="border-b border-[var(--line)] align-top">
                <td className="py-2 pr-2">{i.description}</td>
                <td className="num px-2 py-2 text-right">{i.quantity.toString()}</td>
                <td className="num px-2 py-2 text-right">{money(i.unitPrice)}</td>
                <td className="num py-2 pl-2 text-right font-medium">{money(dec(i.quantity.toString()).times(i.unitPrice.toString()).toDecimalPlaces(2))}</td>
              </tr>
            ))}
            {uber.gt(0) && <tr className="border-b border-[var(--line)]"><td className="py-2" colSpan={3}>Deslocamento</td><td className="num py-2 text-right font-medium">{money(uber)}</td></tr>}
            {q.extraFee.gt(0) && <tr className="border-b border-[var(--line)]"><td className="py-2" colSpan={3}>Taxa extra</td><td className="num py-2 text-right font-medium">{money(q.extraFee)}</td></tr>}
            {q.discount.gt(0) && <tr className="border-b border-[var(--line)]"><td className="py-2" colSpan={3}>Desconto</td><td className="num py-2 text-right font-medium">- {money(q.discount)}</td></tr>}
          </tbody>
          <tfoot><tr><td className="pt-3 text-lg font-bold" colSpan={3}>Total</td><td className="num pt-3 text-right text-lg font-bold">{money(q.totalAmount)}</td></tr></tfoot>
        </table>

        <dl className="grid gap-1.5 text-[0.9375rem]">
          <div><dt className="inline font-semibold">Validade: </dt><dd className="inline">{q.validUntil ? dateBR(q.validUntil, tz) : "a combinar"}</dd></div>
          {q.executionDays != null && <div><dt className="inline font-semibold">Prazo de execução: </dt><dd className="inline">{q.executionDays} dias</dd></div>}
          {q.paymentTerms && <div><dt className="inline font-semibold">Pagamento: </dt><dd className="inline">{q.paymentTerms}</dd></div>}
          {q.warranty && <div><dt className="inline font-semibold">Garantia: </dt><dd className="inline">{q.warranty}</dd></div>}
          {q.notes && <div><dt className="inline font-semibold">Observações: </dt><dd className="inline">{q.notes}</dd></div>}
        </dl>
      </article>
    </>
  );
}
