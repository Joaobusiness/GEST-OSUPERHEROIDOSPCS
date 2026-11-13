import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Empty, OS_STATUS, PageHeader, Status, dateBR, money } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { listOrders } from "@/server/orders";
import type { ServiceOrderStatus } from "@/generated/prisma/client";

export const metadata = { title: "Ordens de serviço" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const { db, tenant } = await requireAuth();
  const status = sp.status && sp.status in OS_STATUS ? (sp.status as ServiceOrderStatus) : undefined;
  const orders = await listOrders(db, { status, q: sp.q });
  const href = (s?: string) => `/ordens?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;
  return (
    <>
      <PageHeader title="Ordens de serviço" action={<Link href="/ordens/nova" className="btn btn-primary"><Plus size={18} aria-hidden /> Nova OS</Link>} />
      <form role="search" className="relative mb-3">
        {status && <input type="hidden" name="status" value={status} />}
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input className="input !pl-10" type="search" name="q" defaultValue={sp.q} placeholder="Buscar por número, cliente ou equipamento" aria-label="Buscar OS" />
      </form>
      <nav aria-label="Filtrar por status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[["", "Todas"], ...Object.entries(OS_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link key={k} href={href(k)} aria-current={(status ?? "") === k ? "true" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${(status ?? "") === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-press)]" : "border-[var(--line)] bg-[var(--card)] text-[var(--text-2)]"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <Empty title={status || sp.q ? "Nenhuma OS encontrada" : "Nenhuma OS ainda"} text={status || sp.q ? "Tente outro filtro ou outra busca." : "Abra a primeira OS quando um cliente deixar um equipamento."} href="/ordens/nova" cta="Nova OS" />
      ) : (
        <ul className="card overflow-hidden">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/ordens/${o.id}`} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.customer.name}</p>
                  <p className="truncate text-sm text-[var(--text-2)]"><span className="num whitespace-nowrap font-medium">{o.orderNumber}</span> · {[o.device?.category, o.device?.brand, o.device?.model].filter(Boolean).join(" ") || o.description}</p>
                  <p className="text-sm text-[var(--text-3)]">{o.deliveredAt ? `Entregue ${dateBR(o.deliveredAt, tenant.timezone)}` : o.estimatedDeliveryAt ? `Previsão ${dateBR(o.estimatedDeliveryAt, tenant.timezone)}` : `Aberta ${dateBR(o.createdAt, tenant.timezone)}`}</p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  <Status map={OS_STATUS} value={o.status} />
                  <span className="num text-sm font-semibold">{money(o.totalAmount)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
