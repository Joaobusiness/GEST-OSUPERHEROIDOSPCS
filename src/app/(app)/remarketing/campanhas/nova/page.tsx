import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { formatPhone } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { SEGMENTS, isSegment, listTemplates, segmentOpportunities } from "@/server/remarketing";
import { createCampaignAction } from "@/server/remarketing-actions";

export const metadata = { title: "Nova campanha" };

export default async function NovaCampanha({ searchParams }: { searchParams: Promise<{ seg?: string; dias?: string; modelo?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAuth();
  const templates = await listTemplates(db);
  const seg = sp.seg && isSegment(sp.seg) ? sp.seg : "inactive";
  const days = Number(sp.dias) > 0 ? Math.floor(Number(sp.dias)) : undefined;
  const tpl = templates.find((t) => t.id === sp.modelo) ?? templates[0];
  const marketing = tpl?.kind === "MARKETING" || SEGMENTS[seg].kind === "MARKETING";
  const rows = tpl ? await segmentOpportunities(db, seg, { days, forKind: marketing ? "MARKETING" : "OPERATIONAL" }) : [];
  const ok = rows.filter((r) => r.eligible);
  const blocked = rows.filter((r) => !r.eligible);

  return (
    <>
      <PageHeader title="Nova campanha" sub="Escolha o segmento e o modelo, depois marque quem entra na lista." />
      <form className="card card-pad mb-6 grid gap-4">
        <Field name="seg" label="Segmento">
          <Select name="seg" defaultValue={seg}>{(Object.keys(SEGMENTS) as (keyof typeof SEGMENTS)[]).map((k) => <option key={k} value={k}>{SEGMENTS[k].label}</option>)}</Select>
        </Field>
        <Field name="dias" label="Dias sem atendimento" hint="Vale só para o segmento Sem atendimento. Vazio usa o padrão da empresa."><Input name="dias" type="number" inputMode="numeric" min={1} defaultValue={days} /></Field>
        <Field name="modelo" label="Modelo">
          <Select name="modelo" defaultValue={tpl?.id}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        </Field>
        <button className="btn btn-quiet">Atualizar lista</button>
      </form>
      {!tpl ? <p>Crie um modelo de mensagem antes de montar a campanha.</p> : (
        <ActionForm action={createCampaignAction}>
          <input type="hidden" name="seg" value={seg} />
          {days && <input type="hidden" name="days" value={days} />}
          <input type="hidden" name="templateId" value={tpl.id} />
          <Field name="name" label="Nome da campanha"><Input name="name" required defaultValue={`${SEGMENTS[seg].label} - ${tpl.name}`} /></Field>
          <fieldset className="grid gap-1">
            <legend className="label pb-1">Clientes ({ok.length})</legend>
            {ok.length === 0 && <p className="text-[0.9375rem] text-[var(--text-2)]">Nenhum cliente elegível neste segmento.</p>}
            <div className="card overflow-hidden">
              {ok.map((r) => (
                <label key={r.customer.id} className="list-row cursor-pointer">
                  <input type="checkbox" name="customerId" value={r.customer.id} defaultChecked className="size-5 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.customer.name}</span><span className="text-sm text-[var(--text-2)]">{formatPhone(r.customer.phone)} · {r.opportunity}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {blocked.length > 0 && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[var(--text-2)]">{blocked.length} fora da lista</summary>
              <ul className="grid gap-1 text-[0.9375rem]">{blocked.map((r) => <li key={r.customer.id}>{r.customer.name}: <span className="text-[var(--text-2)]">{r.reason}</span></li>)}</ul>
            </details>
          )}
          <SubmitButton pendingText="Criando…">Criar campanha</SubmitButton>
        </ActionForm>
      )}
    </>
  );
}
