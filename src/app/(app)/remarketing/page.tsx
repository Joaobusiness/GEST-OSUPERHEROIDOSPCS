import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Empty, PageHeader, dateBR } from "@/components/ui";
import { formatPhone } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { SEGMENTS, isSegment, segmentOpportunities } from "@/server/remarketing";

export const metadata = { title: "Remarketing" };

const PRESETS = [30, 60, 90];
const COLS = "lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_4.5rem_1.3fr_10.5rem]";

export default async function RemarketingPage({ searchParams }: { searchParams: Promise<{ seg?: string; dias?: string }> }) {
  const sp = await searchParams;
  const seg = sp.seg && isSegment(sp.seg) ? sp.seg : "inactive";
  const { db, tenant } = await requireAuth();
  const settings = await db.pricingSettings.findFirst();
  const defaultDays = settings?.inactiveDays ?? 60;
  const days = Number(sp.dias) > 0 ? Math.floor(Number(sp.dias)) : defaultDays;
  const rows = await segmentOpportunities(db, seg, { days });
  const eligible = rows.filter((r) => r.eligible).length;
  const presets = [...new Set([defaultDays, ...PRESETS])].sort((a, b) => a - b);

  return (
    <>
      <PageHeader title="Remarketing" sub="Clientes para recontatar. Você envia cada mensagem, nada é automático." />
      <nav aria-label="Seções" className="mb-4 flex gap-2">
        <Link href="/remarketing/modelos" className="btn btn-quiet btn-sm">Modelos de mensagem</Link>
        <Link href="/remarketing/campanhas" className="btn btn-quiet btn-sm">Campanhas</Link>
      </nav>
      <nav aria-label="Segmentos" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(SEGMENTS) as (keyof typeof SEGMENTS)[]).map((k) => (
          <Link key={k} href={`/remarketing?seg=${k}`} aria-current={k === seg ? "page" : undefined}
            className="pill">{SEGMENTS[k].label}</Link>
        ))}
      </nav>
      {seg === "inactive" && (
        <nav aria-label="Dias sem atendimento" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--text-2)]">Sem atendimento há</span>
          {presets.map((d) => (
            <Link key={d} href={`/remarketing?seg=inactive&dias=${d}`} aria-current={d === days ? "page" : undefined}
              className="pill">{d} dias</Link>
          ))}
        </nav>
      )}
      {SEGMENTS[seg].kind === "MARKETING" && (
        <p className="mb-3 text-[0.9375rem] text-[var(--text-2)]">Marketing: só clientes que autorizaram. {eligible} de {rows.length} podem receber.</p>
      )}
      {rows.length === 0 ? (
        <Empty title="Ninguém neste segmento" text="Quando algum cliente se encaixar, ele aparece aqui." />
      ) : (
        <div className="card overflow-hidden">
          <div className={`hidden gap-3 border-b border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--text-2)] lg:grid ${COLS}`}>
            <span>Cliente</span><span>Telefone</span><span>Último atendimento</span><span>Último serviço</span><span>Dias</span><span>Oportunidade</span><span>Ação</span>
          </div>
          {rows.map((r) => (
            <div key={r.customer.id} className={`grid gap-1 border-t border-[var(--line)] px-5 py-3 first:border-t-0 lg:items-center lg:gap-3 ${COLS}`}>
              <Link href={`/clientes/${r.customer.id}`} className="min-w-0 truncate font-semibold">{r.customer.name}</Link>
              <span className="text-sm lg:text-base">{formatPhone(r.customer.phone)}</span>
              <span className="text-sm text-[var(--text-2)] lg:text-base lg:text-[var(--text)]">{r.lastServiceAt ? dateBR(r.lastServiceAt, tenant.timezone) : "Nunca"}</span>
              <span className="truncate text-sm text-[var(--text-2)] lg:text-base lg:text-[var(--text)]">{r.lastService ?? "—"}</span>
              <span className="text-sm lg:text-base"><span className="lg:hidden">Dias: </span>{r.daysInactive}</span>
              <span className="text-sm lg:text-base">{r.opportunity}</span>
              {r.eligible ? (
                <Link href={`/remarketing/mensagem?cliente=${r.customer.id}&seg=${seg}`} className="btn btn-primary btn-sm mt-1 lg:mt-0"><MessageCircle size={16} aria-hidden /> Abrir WhatsApp</Link>
              ) : (
                <span className="chip chip-warn mt-1 w-fit lg:mt-0">{r.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
