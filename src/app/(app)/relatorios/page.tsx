import { Download } from "lucide-react";
import { Empty, money, OS_STATUS, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { cashReport, ordersByStatus, resolvePeriod } from "@/server/finance";
import { first, PeriodFilter, qs, type SP } from "../financeiro/parts";

export const metadata = { title: "Relatórios" };

const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]}/${y}`;
};

export default async function Relatorios({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, tenant } = await requireAuth();
  const sp = await searchParams;
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, tenant.timezone);
  const [r, byStatus] = await Promise.all([cashReport(db, period, tenant.timezone), ordersByStatus(db, period)]);
  const csv = `/relatorios/csv${qs({ p: period.key, de: period.key === "custom" ? period.from : undefined, ate: period.key === "custom" ? period.to : undefined })}`;
  const nothing = r.byMonth.length === 0 && byStatus.length === 0;

  return (
    <>
      <PageHeader title="Relatórios" sub="Valores em regime de caixa: só o que foi pago ou recebido no período." action={
        <a href={csv} download className="btn btn-quiet btn-sm"><Download size={18} aria-hidden /> CSV</a>
      } />
      <PeriodFilter base="/relatorios" period={period} />

      {nothing ? (
        <Empty title="Sem movimento neste período" text="Quando houver pagamentos registrados ou ordens abertas, os relatórios aparecem aqui." href="/financeiro" cta="Ir ao financeiro" />
      ) : (
        <div className="grid gap-6">
          <Table title="Resultado por mês" head={["Mês", "Recebido", "Pago", "Resultado"]} empty="Nenhum pagamento no período."
            rows={r.byMonth.map((m) => [monthLabel(m.month), money(m.income), money(m.expense), money(m.net)])} />
          <Table title="Resultado por categoria" head={["Categoria", "Tipo", "Valor"]} empty="Nenhum pagamento no período."
            rows={r.byCategory.map((c) => [c.name, c.type === "INCOME" ? "Receita" : "Despesa", money(c.total)])} />
          <Table title="Clientes que mais pagaram" head={["Cliente", "Recebido"]} empty="Nenhum recebimento de cliente no período."
            rows={r.topCustomers.map((c) => [c.name, money(c.total)])} />
          <Table title="Serviços abertos no período, por situação" head={["Situação", "Ordens"]} empty="Nenhuma ordem aberta no período."
            rows={byStatus.map((s) => [OS_STATUS[s.status]?.label ?? s.status, String(s.count)])} />
        </div>
      )}
    </>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: string[][]; empty: string }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2">{title}</h2>
      {rows.length === 0 ? (
        <p className="card card-pad text-[var(--text-2)]">{empty}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[0.9375rem]">
            <thead>
              <tr className="border-b border-[var(--line)] text-sm text-[var(--text-2)]">
                {head.map((h, i) => <th key={h} scope="col" className={`px-4 py-3 font-semibold ${i === head.length - 1 ? "text-right" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--line)] last:border-0">
                  {row.map((cell, i) => <td key={i} className={`px-4 py-3 ${i > 0 ? "num" : "font-medium"} ${i === row.length - 1 ? "text-right" : ""}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
