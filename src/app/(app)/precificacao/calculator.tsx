"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { calculatePrice, PricingError, brl, type UberMode } from "@/lib/pricing";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { saveSimulationAction } from "@/server/pricing-actions";
import { toPricingInput, type SimInput } from "./sim";

const UBER_HELP: Record<UberMode, string> = {
  INCLUDED: "O Uber entra dentro do preço do serviço. O cliente não vê uma linha separada.",
  SEPARATE: "O Uber aparece como uma linha à parte no orçamento. Você cobra o mesmo valor que pagou.",
  ABSORBED: "Você paga o Uber e não cobra nada por ele. O valor sai do seu lucro.",
};

type Typed = "partCost" | "laborCost" | "uberCost" | "marginPct";

export function Calculator({ initial }: { initial: SimInput }) {
  const [s, setS] = useState<SimInput>(initial);
  const field = (k: Typed) => ({
    inputMode: "decimal" as const, autoComplete: "off", value: s[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: e.target.value })),
  });

  const out = useMemo(() => {
    const built = toPricingInput(s);
    if ("error" in built) return { error: built.error };
    try { return { r: calculatePrice(built.input) }; } catch (e) {
      if (e instanceof PricingError) return { error: e.message };
      throw e;
    }
  }, [s]);

  const r = out.r;
  const quoteHref = r
    ? `/orcamentos/novo?${new URLSearchParams({
        preco: r.finalPrice, custo: r.totalCost, uberModo: s.uberMode, uberCusto: r.logisticsCost, uberCobrado: r.uberCharge,
        margem: s.marginPct, imposto: "0", cartao: "0",
      })}`
    : "#";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem] lg:items-start">
      <section className="card card-pad grid gap-5" aria-label="Dados da simulação">
        <div className="grid gap-3">
          <h2>Quanto você gasta</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field name="partCost" label="Peça (R$)"><Input {...field("partCost")} placeholder="0,00" /></Field>
            <Field name="laborCost" label="Sua mão de obra (R$)"><Input {...field("laborCost")} placeholder="0,00" /></Field>
          </div>
        </div>

        <div className="grid gap-3">
          <h2>Uber</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field name="uberCost" label="Quanto custou o Uber (R$)"><Input {...field("uberCost")} placeholder="0,00" /></Field>
            <Field name="uberMode" label="Como cobrar">
              <Select value={s.uberMode} onChange={(e) => setS((p) => ({ ...p, uberMode: e.target.value as UberMode }))}>
                <option value="INCLUDED">Dentro do preço</option>
                <option value="SEPARATE">Linha separada</option>
                <option value="ABSORBED">Eu pago, não cobro</option>
              </Select>
            </Field>
          </div>
          <p className="hint">{UBER_HELP[s.uberMode]}</p>
        </div>

        <div className="grid gap-3">
          <h2>Quanto você quer ganhar</h2>
          <Field name="marginPct" label="Margem de lucro (%)" hint="É a parte do preço final que fica com você. Com 40%, de cada R$ 100 que o cliente paga, R$ 40 são lucro.">
            <Input {...field("marginPct")} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 lg:sticky lg:top-4" aria-label="Resultado" aria-live="polite">
        {out.error && <p role="alert" className="chip chip-bad !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">{out.error}</p>}
        {r && (
          <div className="hero grid gap-5 p-5">
            <div>
              <p className="text-sm text-white">O cliente paga</p>
              <p className="num text-[2.5rem] font-bold leading-tight text-white">{brl(r.finalPrice)}</p>
            </div>
            <dl className="grid gap-2.5 border-t border-white/20 pt-4 text-[0.9375rem]">
              <Row k={s.uberMode === "SEPARATE" ? "Serviço" : "Serviço (já com o Uber)"} v={brl(r.suggestedPrice)} />
              {s.uberMode === "SEPARATE" && <Row k="Uber, em linha separada" v={brl(r.uberCharge)} />}
              <Row k="Você gasta" v={brl(r.totalCost)} />
              <Row k="Sobra para você" v={brl(r.profit)} strong />
              <Row k="Margem real" v={`${r.effectiveMarginPct.replace(".", ",")}%`} strong />
            </dl>
            <Link href={quoteHref} className="btn bg-white text-[var(--accent-press)] shadow-[0_8px_20px_rgba(0,0,0,.18)]"><FilePlus2 size={18} aria-hidden /> Criar orçamento com este preço</Link>
          </div>
        )}
        <div className="card card-pad">
          <ActionForm action={saveSimulationAction}>
            <input type="hidden" name="input" value={JSON.stringify(s)} />
            <Field name="label" label="Nome (opcional)"><Input name="label" maxLength={80} placeholder="Ex.: troca de tela Dell" /></Field>
            <SubmitButton className="btn btn-quiet">Guardar no histórico</SubmitButton>
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
      <dt className="text-white">{k}</dt>
      <dd className={`num ${strong ? "font-bold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
