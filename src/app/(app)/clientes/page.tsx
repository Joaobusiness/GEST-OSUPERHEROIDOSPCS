import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Empty, PageHeader } from "@/components/ui";
import { formatPhone } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { listCustomers } from "@/server/crm";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { db } = await requireAuth();
  const customers = await listCustomers(db, q);
  return (
    <>
      <PageHeader title="Clientes" action={<Link href="/clientes/novo" className="btn btn-primary btn-sm"><Plus size={18} aria-hidden /> Novo cliente</Link>} />
      <form role="search" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} type="search" className="input" placeholder="Nome, telefone ou CPF/CNPJ" aria-label="Buscar cliente" />
        <button className="btn btn-quiet shrink-0" aria-label="Buscar"><Search size={20} aria-hidden /></button>
      </form>
      {customers.length === 0 ? (
        q
          ? <Empty title="Nenhum cliente encontrado" text={`Nada para "${q}". Confira o nome ou o número.`} href="/clientes" cta="Limpar busca" />
          : <Empty title="Nenhum cliente ainda" text="Cadastre o primeiro cliente com nome e telefone. O resto pode vir depois." href="/clientes/novo" cta="Cadastrar cliente" />
      ) : (
        <div className="card overflow-hidden">
          {customers.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-sm text-[var(--text-2)]">{formatPhone(c.phone)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {c.pendingQuote && <span className="chip chip-warn">Orçamento pendente</span>}
                {c.inactive && <span className="chip">Inativo</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
