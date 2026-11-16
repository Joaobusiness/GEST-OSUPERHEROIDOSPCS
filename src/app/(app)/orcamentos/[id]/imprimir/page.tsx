import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dateBR, money } from "@/components/ui";
import { uuid } from "@/lib/action";
import { formatPhone } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { dec, uberCharge } from "@/server/line-items";
import { PrintButton } from "../../share-buttons";

const load = cache(async (id: string) => {
  if (!uuid.safeParse(id).success) notFound();
  const { db, tenant } = await requireAuth();
  const q = await db.quote.findFirst({ where: { id }, include: { customer: true, items: { orderBy: { id: "asc" } } } });
  if (!q) notFound();
  return { q, tenant };
});

// O navegador usa o título da página como nome do arquivo ao salvar o PDF.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { q } = await load((await params).id);
  return { title: { absolute: `ORÇAMENTO - ${q.customer.name}` } };
}

// A margem do papel vem de spacers repetidos no topo e no pé da tabela (thead/tfoot) e de padding lateral:
// com @page margin 0 o navegador deixa de imprimir a URL, a data e o título nas bordas da folha.
// html menor escala tudo em rem: um orçamento comum cabe em uma folha A4; muitos itens quebram em mais folhas.
const PRINT_CSS = `
.pg-gap { height: 0; }
@page { size: A4; margin: 0; }
@media print {
  html { font-size: 13px; }
  aside, nav, header { display: none !important; }
  .paper header { display: grid !important; }
  body { background: #fff !important; }
  main { max-width: none !important; padding: 0 !important; }
  .paper-wrap { background: none !important; padding: 0 !important; border-radius: 0 !important; }
  .paper { box-shadow: none !important; border-radius: 0 !important; padding: 0 12mm !important; max-width: none !important; gap: 1rem !important; }
  .pg-gap { height: 12mm; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`;

type Addr = { street?: string; number?: string; district?: string; city?: string; state?: string; zip?: string };
const addrLine = (a: unknown) => {
  const x = (a ?? {}) as Addr;
  return [[x.street, x.number].filter(Boolean).join(", "), x.district, [x.city, x.state].filter(Boolean).join("/")].filter(Boolean).join(" - ");
};

type Row = { id: string; description: string; quantity: { toString(): string }; unitPrice: { toString(): string } };

function ItemsTable({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  const sub = rows.reduce((a, i) => a.plus(dec(i.quantity.toString()).times(i.unitPrice.toString()).toDecimalPlaces(2)), dec(0));
  return (
    <section>
      <h2 className="mb-2 break-after-avoid text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">{title}</h2>
      <table className="w-full table-fixed text-left text-[0.9375rem]">
        <thead>
          <tr className="border-b-2 border-[var(--accent)] text-xs uppercase tracking-wide text-[var(--text-2)]">
            <th className="py-2 pr-2 font-semibold">Descrição</th>
            <th className="w-12 px-1 text-right font-semibold sm:w-16">Qtd.</th>
            <th className="w-20 px-1 text-right font-semibold sm:w-28">Unitário</th>
            <th className="w-20 pl-1 text-right font-semibold sm:w-28">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="break-inside-avoid border-b border-[var(--line)] align-top">
              <td className="break-words py-1.5 pr-2">{i.description}</td>
              <td className="num px-1 py-1.5 text-right">{i.quantity.toString()}</td>
              <td className="num px-1 py-1.5 text-right">{money(i.unitPrice as never)}</td>
              <td className="num py-1.5 pl-1 text-right font-semibold">{money(dec(i.quantity.toString()).times(i.unitPrice.toString()).toDecimalPlaces(2))}</td>
            </tr>
          ))}
          <tr className="break-inside-avoid"><td colSpan={3} className="pt-2 text-right text-sm text-[var(--text-2)]">Subtotal</td><td className="num pt-2 text-right font-semibold">{money(sub)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { q, tenant } = await load((await params).id);
  const tz = tenant.timezone;
  const uber = uberCharge(q, q);
  const services = q.items.filter((i) => i.kind !== "PART");
  const products = q.items.filter((i) => i.kind === "PART");
  const phones = [tenant.phone && formatPhone(tenant.phone), tenant.whatsapp && tenant.whatsapp !== tenant.phone ? `WhatsApp ${formatPhone(tenant.whatsapp)}` : null].filter(Boolean);
  const company = [phones.join("  |  "), tenant.email, addrLine(tenant.address)].filter(Boolean);
  const cust = [formatPhone(q.customer.whatsapp || q.customer.phone), q.customer.email, q.customer.document, addrLine(q.customer.address)].filter(Boolean);
  const terms: [string, string][] = [
    ["Validade", q.validUntil ? dateBR(q.validUntil, tz) : "A combinar"],
    ...(q.executionDays != null ? [["Prazo", `${q.executionDays} dias`] as [string, string]] : []),
    ...(q.paymentTerms ? [["Pagamento", q.paymentTerms] as [string, string]] : []),
    ...(q.warranty ? [["Garantia", q.warranty] as [string, string]] : []),
  ];

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="mx-auto mb-4 flex max-w-[794px] items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-[var(--text-2)]">Na janela que abrir, escolha &quot;Salvar como PDF&quot;.</p>
        <PrintButton />
      </div>
      <div className="paper-wrap rounded-[var(--r-lg)] bg-[var(--line)] p-2 sm:p-6">
        <table className="mx-auto w-full max-w-[794px]"><thead><tr><td className="p-0"><div className="pg-gap" /></td></tr></thead><tbody><tr><td className="p-0 align-top">
        <article className="paper mx-auto grid gap-5 bg-white p-5 text-[var(--ink)] shadow-[var(--shadow-2)] sm:p-10">
          <header className="grid gap-4 border-b-4 border-[var(--accent)] pb-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="grid min-w-0 gap-3">
              {tenant.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={tenant.logoUrl} alt={tenant.name} className="max-h-28 w-auto max-w-[320px] object-contain object-left" />
                : <p className="break-words text-3xl font-extrabold leading-tight tracking-tight">{tenant.name}</p>}
              <div className="grid gap-0.5 text-sm text-[var(--text-2)]">
                {tenant.logoUrl && <p className="font-semibold text-[var(--ink)]">{tenant.name}</p>}
                {tenant.document && <p>{tenant.document}</p>}
                {company.map((c) => <p key={c} className="break-words">{c}</p>)}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Orçamento</p>
              <p className="num text-2xl font-extrabold">{q.number}</p>
              <p className="mt-1 text-sm text-[var(--text-2)]">Emitido em {dateBR(q.createdAt, tz)}</p>
              <p className="text-sm text-[var(--text-2)]">Válido até {q.validUntil ? dateBR(q.validUntil, tz) : "a combinar"}</p>
            </div>
          </header>

          <section className="break-inside-avoid rounded-[var(--r-md)] bg-[var(--bg)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Para</p>
            <p className="mt-1 text-lg font-bold">{q.customer.name}</p>
            <div className="text-sm text-[var(--text-2)]">{cust.map((c) => <p key={c} className="break-words">{c}</p>)}</div>
          </section>

          <ItemsTable title="Serviços" rows={services} />
          <ItemsTable title="Produtos e peças" rows={products} />

          <section className="break-inside-avoid ml-auto grid w-full gap-1.5 text-[0.9375rem] sm:w-80">
            {uber.gt(0) && <p className="flex justify-between"><span className="text-[var(--text-2)]">Deslocamento</span><span className="num font-semibold">{money(uber)}</span></p>}
            {q.discount.gt(0) && <p className="flex justify-between"><span className="text-[var(--text-2)]">Desconto</span><span className="num font-semibold">- {money(q.discount)}</span></p>}
            <p className="mt-2 flex items-baseline justify-between gap-3 rounded-[var(--r-md)] bg-[var(--accent)] px-4 py-3 text-white">
              <span className="text-sm font-bold uppercase tracking-wide">Total</span><span className="num text-2xl font-extrabold">{money(q.totalAmount)}</span>
            </p>
          </section>

          {q.notes && (
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Explicação do serviço</h2>
              <p className="whitespace-pre-line break-words border-l-4 border-[var(--accent)] pl-4 text-base leading-relaxed">{q.notes}</p>
            </section>
          )}

          <section className="break-inside-avoid">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Condições</h2>
            <dl className="grid gap-x-6 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
              {terms.map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wide text-[var(--text-2)]">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
            </dl>
          </section>

          <footer className="break-inside-avoid border-t border-[var(--line)] pt-4 text-center text-sm text-[var(--text-2)]">
            ORÇAMENTO GERADO POR{" "}
            <a href="https://gestaosuperheroi.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)] underline">https://gestaosuperheroi.vercel.app/</a>
          </footer>
        </article>
        </td></tr></tbody><tfoot><tr><td className="p-0"><div className="pg-gap" /></td></tr></tfoot></table>
      </div>
    </>
  );
}
