import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Empty, PageHeader, dateBR, money } from "@/components/ui";
import { formatPhone, whatsappLink } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { CrmError, addressText, getCustomer, inactiveDays } from "@/server/crm";
import { deleteCustomerAction } from "@/server/crm-actions";
import { ConfirmButton } from "../confirm-button";

export const metadata = { title: "Cliente" };

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, tenant } = await requireAuth();
  const c = await getCustomer(db, id).catch((e) => { if (e instanceof CrmError) return null; throw e; });
  if (!c) notFound();
  const [done, pending, days] = await Promise.all([
    db.quote.findMany({
      where: { customerId: id, status: "APPROVED" },
      orderBy: { decidedAt: "desc" }, take: 100,
      select: { id: true, number: true, totalAmount: true, decidedAt: true, createdAt: true, items: { take: 2, orderBy: { id: "asc" }, select: { description: true } } },
    }),
    db.quote.count({ where: { customerId: id, status: "SENT" } }),
    inactiveDays(db),
  ]);
  const tz = tenant.timezone;
  const address = addressText(c.address);
  const lastService = done[0]?.decidedAt ?? done[0]?.createdAt ?? c.createdAt;
  const inactive = isInactive(lastService, days);

  return (
    <>
      <PageHeader
        title={c.name}
        sub={formatPhone(c.phone)}
        action={<Link href={`/clientes/${id}/editar`} className="btn btn-quiet btn-sm"><Pencil size={16} aria-hidden /> Editar</Link>}
      />
      {(pending > 0 || inactive) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pending > 0 && <span className="chip chip-warn">Orçamento esperando resposta</span>}
          {inactive && <span className="chip">Faz tempo que não volta</span>}
        </div>
      )}
      <a href={whatsappLink(c.whatsapp ?? c.phone, "")} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full sm:w-auto">
        <MessageCircle size={20} aria-hidden /> Abrir WhatsApp
      </a>

      <section className="mt-8 grid gap-3" aria-labelledby="servicos">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="servicos">Serviços feitos</h2>
          {done.length > 0 && <span className="num text-sm text-[var(--text-2)]">{done.length} {done.length === 1 ? "serviço" : "serviços"}</span>}
        </div>
        {done.length === 0 ? (
          <Empty title="Nenhum serviço feito ainda" text="Quando um orçamento deste cliente for aprovado, ele aparece aqui com a data." href={`/orcamentos/novo?cliente=${id}`} cta="Novo orçamento" />
        ) : (
          <ul className="card stagger overflow-hidden">
            {done.map((q) => {
              const when = dateBR(q.decidedAt ?? q.createdAt, tz);
              return (
                <li key={q.id}>
                  <Link href={`/orcamentos/${q.id}`} className="list-row">
                    <span className="num w-[4.25rem] shrink-0 text-sm font-semibold text-[var(--text-2)]">
                      {when.slice(0, 5)}
                      <span className="block text-xs font-medium text-[var(--text-3)]">{when.slice(6)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{q.items.map((i) => i.description).filter(Boolean).join(", ") || q.number}</span>
                      <span className="block truncate text-sm text-[var(--text-2)]">{q.number}</span>
                    </span>
                    <span className="num shrink-0 font-semibold">{money(q.totalAmount)}</span>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--text-3)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 grid gap-3" aria-labelledby="contato">
        <h2 id="contato">Contato</h2>
        <dl className="card grid gap-3 p-5 text-[0.9375rem]">
          {c.whatsapp && <Row k="WhatsApp" v={formatPhone(c.whatsapp)} />}
          {c.email && <Row k="E-mail" v={c.email} />}
          {c.document && <Row k="CPF/CNPJ" v={c.document} />}
          {address && <Row k="Endereço" v={address} />}
          {c.notes && <Row k="Observações" v={c.notes} />}
          {!c.whatsapp && !c.email && !c.document && !address && !c.notes && <p className="text-[var(--text-2)]">Só o telefone está cadastrado. Toque em Editar para completar.</p>}
        </dl>
      </section>

      <form action={deleteCustomerAction} className="mt-10">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton message="Excluir este cliente? Se ele tiver serviços, será arquivado e sai das listas." className="btn btn-danger w-full sm:w-auto">
          <Trash2 size={18} aria-hidden /> Excluir cliente
        </ConfirmButton>
      </form>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[var(--text-2)]">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

/** Outside the component: it reads the clock, which render code must not. */
function isInactive(since: Date, days: number) {
  return Date.now() - since.getTime() >= days * 86_400_000;
}
