import { Avatar } from "@/components/ui";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Empty, PageHeader, Pager, QUOTE_STATUS, Status, dateBR, money } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { listQuotes } from "@/server/quotes";
import type { QuoteStatus } from "@/generated/prisma/client";

export const metadata = { title: "Orçamentos" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pg?: string }> }) {
  const sp = await searchParams;
  const { db, tenant } = await requireAuth();
  const status = sp.status && sp.status in QUOTE_STATUS ? (sp.status as QuoteStatus) : undefined;
  const list = await listQuotes(db, { status, q: sp.q, page: Number.parseInt(sp.pg ?? "1", 10) || 1 });
  const quotes = list.rows;
  const href = (s?: string) => `/orcamentos?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;
  return (
    <>
      <PageHeader title="Orçamentos" action={<Link href="/orcamentos/novo" className="btn btn-primary"><Plus size={18} aria-hidden /> Novo</Link>} />
      <form role="search" className="relative mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input className="input !pl-10" type="search" name="q" defaultValue={sp.q} placeholder="Buscar por número ou cliente" aria-label="Buscar orçamento" />
      </form>
      <nav aria-label="Filtrar por status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[["", "Todos"], ...Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link key={k} href={href(k)} aria-current={(status ?? "") === k ? "true" : undefined}
            className="pill">
            {label}
          </Link>
        ))}
      </nav>
      {quotes.length === 0 ? (
        <Empty title={status || sp.q ? "Nenhum orçamento encontrado" : "Nenhum orçamento ainda"} text={status || sp.q ? "Tente outro filtro ou outra busca." : "Monte um orçamento e envie ao cliente pelo WhatsApp."} href="/orcamentos/novo" cta="Novo orçamento" />
      ) : (
        <ul className="card stagger overflow-hidden">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/orcamentos/${q.id}`} className="list-row">
                <Avatar name={q.customer.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{q.customer.name}</p>
                  <p className="flex items-center gap-2 text-sm text-[var(--text-2)]"><span className="num">{q.number}</span><span className="text-[var(--text-3)]">rev. {q.revision}</span></p>
                  <p className="text-sm text-[var(--text-3)]">{q.validUntil ? `Válido até ${dateBR(q.validUntil, tenant.timezone)}` : `Criado ${dateBR(q.createdAt, tenant.timezone)}`}</p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  <Status map={QUOTE_STATUS} value={q.status} />
                  <span className="num text-sm font-semibold">{money(q.totalAmount)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={list.page} pages={list.pages} href={(n) => `/orcamentos?${new URLSearchParams({ ...(status ? { status } : {}), ...(sp.q ? { q: sp.q } : {}), pg: String(n) })}`} />
    </>
  );
}
