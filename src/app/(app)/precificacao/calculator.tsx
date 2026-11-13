"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FilePlus2 } from "lucide-react";
import { calculatePrice, PricingError, brl, type UberMode } from "@/lib/pricing";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { saveSimulationAction } from "@/server/pricing-actions";
import { toPricingInput, type SimInput } from "./sim";

const UBER_HELP: Record<UberMode, string> = {
  INCLUDED: "Incluído: o custo do Uber entra no custo do serviço e já está dentro do preço. O cliente não vê uma linha separada.",
  SEPARATE: "Separado: o Uber aparece como uma linha própria no orçamento, somada ao preço do serviço.",
  ABSORBED: "Absorvido: você paga o Uber e não cobra nada por ele. O custo reduz o seu lucro.",
};

const num = (props: { value: string; set: (v: string) => void }) => ({
  inputMode: "decimal" as const, autoComplete: "off", value: props.value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => props.set(e.target.value),
});

export function Calculator({ initial, minMarginPct }: { initial: SimInput; minMarginPct: string }) {
  const [s, setS] = useState<SimInput>(initial);
  const field = (k: Exclude<keyof SimInput, "uberMode" | "uberMarkup">) => num({ value: s[k], set: (v) => setS((p) => ({ ...p, [k]: v })) });

  const out = useMemo(() => {
    const built = toPricingInput(s);
    if ("error" in built) return { error: built.error };
    try { return { r: calculatePrice(built.input, minMarginPct) }; } catch (e) {
      if (e instanceof PricingError) return { error: e.message };
      throw e;
    }
  }, [s, minMarginPct]);

  const r = out.r;
  const quoteHref = r
    ? `/orcamentos/novo?${new URLSearchParams({
        preco: r.finalPrice, custo: r.totalCost, uberModo: s.uberMode, uberCusto: r.logisticsCost, uberCobrado: r.uberCharge,
        margem: s.marginPct, imposto: s.taxPct, cartao: s.cardFeePct,
      })}`
    : "#";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section className="card card-pad grid gap-4" aria-label="Dados da simulação">
        <h2>Custos</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field name="partCost" label="Custo da peça (R$)"><Input {...field("partCost")} placeholder="0,00" /></Field>
          <Field name="laborCost" label="Custo da mão de obra (R$)"><Input {...field("laborCost")} placeholder="0,00" /></Field>
        </div>
        <Field name="laborPrice" label="Preço desejado da mão de obra (R$)" hint="Opcional. Se preencher, esse valor é cobrado sem margem e o custo acima só entra no lucro.">
          <Input {...field("laborPrice")} placeholder="Deixe vazio para calcular" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="otherCosts" label="Outros custos (R$)"><Input {...field("otherCosts")} placeholder="0,00" /></Field>
          <Field name="fixedFees" label="Taxas fixas (R$)"><Input {...field("fixedFees")} placeholder="0,00" /></Field>
        </div>

        <h2 className="pt-2">Uber</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field name="uberCost" label="Custo do Uber (R$)"><Input {...field("uberCost")} placeholder="0,00" /></Field>
          <Field name="uberMode" label="Como cobrar">
            <Select value={s.uberMode} onChange={(e) => setS((p) => ({ ...p, uberMode: e.target.value as UberMode }))}>
              <option value="INCLUDED">Incluído no preço</option>
              <option value="SEPARATE">Cobrado separado</option>
              <option value="ABSORBED">Absorvido por mim</option>
            </Select>
          </Field>
        </div>
        <p className="hint">{UBER_HELP[s.uberMode]}</p>
        {s.uberMode === "SEPARATE" && (
          <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={s.uberMarkup} onChange={(e) => setS((p) => ({ ...p, uberMarkup: e.target.checked }))} />
            <span>Cobrar o Uber com margem (desmarcado: repasse puro, só recupera as taxas)</span>
          </label>
        )}

        <h2 className="pt-2">Margem e taxas</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field name="marginPct" label="Margem (%)"><Input {...field("marginPct")} /></Field>
          <Field name="taxPct" label="Imposto (%)"><Input {...field("taxPct")} /></Field>
          <Field name="cardFeePct" label="Cartão (%)"><Input {...field("cardFeePct")} /></Field>
        </div>
        <p className="hint">A margem é sobre o preço de venda, e imposto e cartão também. Os padrões vêm das suas configurações.</p>
        <Field name="manualPrice" label="Preço manual ao cliente (R$)" hint="Opcional. Troca o preço sugerido e recalcula a margem real na hora.">
          <Input {...field("manualPrice")} placeholder="Deixe vazio para usar o sugerido" />
        </Field>
      </section>

      <section className="grid gap-4 lg:sticky lg:top-4" aria-label="Resultado" aria-live="polite">
        {out.error && <p role="alert" className="chip chip-bad !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">{out.error}</p>}
        {r && (
          <div className="card-ink grid gap-4 p-5">
            <div>
              <p className="text-sm text-[var(--on-ink-2)]">Preço final ao cliente</p>
              <p className="num text-[2.25rem] font-bold leading-tight text-[var(--gold)]">{brl(r.finalPrice)}</p>
            </div>
            <dl className="grid gap-2 text-[0.9375rem]">
              <Row k="Custo total" v={brl(r.totalCost)} />
              <Row k="Preço sugerido" v={brl(r.suggestedPrice)} />
              {s.uberMode === "SEPARATE" && <Row k="Uber cobrado à parte" v={brl(r.uberCharge)} />}
              <Row k="Custo logístico (Uber)" v={brl(r.logisticsCost)} />
              <Row k={`Taxas (${r.feesPct.replace(".", ",")}%)`} v={brl(r.feesAmount)} />
              <Row k="Lucro estimado" v={brl(r.profit)} strong />
              <Row k="Margem efetiva" v={`${r.effectiveMarginPct.replace(".", ",")}%`} strong />
            </dl>
            {r.belowMinMargin && (
              <p role="status" className="flex items-start gap-2 rounded-[var(--r-md)] bg-[var(--warn-soft)] p-3 text-sm text-[var(--warn)]">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
                Margem efetiva abaixo do mínimo de {minMarginPct.replace(".", ",")}%. Você ainda pode seguir com este preço.
              </p>
            )}
            <Link href={quoteHref} className="btn btn-primary"><FilePlus2 size={18} aria-hidden /> Criar orçamento com este preço</Link>
          </div>
        )}
        <div className="card card-pad">
          <ActionForm action={saveSimulationAction}>
            <input type="hidden" name="input" value={JSON.stringify(s)} />
            <Field name="label" label="Nome da simulação (opcional)"><Input name="label" maxLength={80} placeholder="Ex.: troca de tela Dell" /></Field>
            <SubmitButton className="btn btn-quiet">Salvar no histórico</SubmitButton>
          </ActionForm>
          <Link href="/precificacao/historico" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]">Ver histórico</Link>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--on-ink-2)]">{k}</dt>
      <dd className={`num ${strong ? "font-bold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
