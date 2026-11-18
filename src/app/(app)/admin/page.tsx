import { requireSuperAdmin } from "@/server/auth";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Empty, PageHeader, Pager, Status, dateBR, money } from "@/components/ui";
import { Search } from "lucide-react";
import { countTenants, listTenants, platformStats } from "@/server/admin";
import { SUB, TENANT } from "./status";

const SIZE = 20;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; pg?: string }> }) {
  await requireSuperAdmin(); // the layout check alone is not enough: pages and actions can be reached without it
  const { q, pg } = await searchParams;
  const total = await countTenants(q);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(pg ?? "1", 10) || 1), pages);
  const [stats, tenants] = await Promise.all([platformStats(), listTenants({ q, skip: (page - 1) * SIZE, take: SIZE })]);
  const items: [string, string][] = [
    ["Empresas", String(stats.tenants)], ["Empresas ativas", String(stats.activeTenants)], ["Usuários", String(stats.users)],
    ["Receita mensal recorrente", money(stats.mrr)],
  ];
  return (
    <>
      <PageHeader title="Empresas" sub="Visão da plataforma. Só contagens, nunca dados de clientes das empresas." />
      <dl className="card mb-6 grid grid-cols-2 gap-px overflow-hidden bg-[var(--line)] sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="bg-[var(--card)] p-4">
            <dt className="text-[0.8125rem] text-[var(--text-2)]">{k}</dt>
            <dd className="num text-xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <form role="search" className="relative mb-3">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input className="input !pl-10" type="search" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar empresa" />
      </form>
      {tenants.length === 0 ? (
        q ? <Empty title="Nenhuma empresa encontrada" text={`Nada para "${q}".`} href="/admin" cta="Limpar busca" /> : <Empty title="Nenhuma empresa cadastrada" text="As empresas aparecem aqui quando criam uma conta." />
      ) : (
        <ul className="card overflow-hidden">
          {tenants.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/empresas/${t.id}`} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="truncate text-sm text-[var(--text-2)]">{t.email} · criada em {dateBR(t.createdAt)}</p>
                  <p className="num text-sm text-[var(--text-2)]">{t.customerCount} clientes · {t.userCount} usuários · {t.planName ?? "sem plano"}{t.expiresAt ? ` até ${dateBR(t.expiresAt)}` : ""}</p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  <Status map={TENANT} value={t.status} />
                  {t.subscriptionStatus && <Status map={SUB} value={t.subscriptionStatus} />}
                </div>
                <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--text-3)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pages={pages} href={(n) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), pg: String(n) })}`} />
    </>
  );
}
