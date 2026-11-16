"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { calculatePrice, PricingError, brl } from "@/lib/pricing";
import { ActionForm, Field, Input, SubmitButton, YesNo } from "@/components/form";
import { saveSimulationAction } from "@/server/pricing-actions";
import { toPricingInput, type SimInput } from "./sim";

type Typed = "partCost" | "laborCost" | "uberCost" | "markupPct";

const storage = () => { try { return window.localStorage; } catch { return null; } };
const noSubscribe = () => () => {};

/** Keeps the account being typed on this device, so leaving for another module and coming back loses nothing. `draftKey` null = a saved simulation is open: never mixed with the draft. */
export function Calculator({ initial, draftKey, defaultUberCost }: { initial: SimInput; draftKey: string | null; defaultUberCost: string }) {
  const read = useRef<SimInput | null | undefined>(undefined);
  const draft = useSyncExternalStore(noSubscribe, () => {
    if (read.current !== undefined) return read.current;
    try {
      const d = draftKey ? JSON.parse(storage()?.getItem(draftKey) ?? "null") : null;
      return (read.current = d && typeof d.markupPct === "string" && typeof d.uberOn === "boolean" ? { ...initial, ...d } : null);
    } catch { return (read.current = null); }
  }, () => null);
  return <Calc key={draft ? "draft" : "clean"} initial={initial} start={draft ?? initial} draftKey={draftKey} defaultUberCost={defaultUberCost} />;
}

function Calc({ initial, start, draftKey, defaultUberCost }: { initial: SimInput; start: SimInput; draftKey: string | null; defaultUberCost: string }) {
  const [s, setS] = useState<SimInput>(start);
  const uberInput = useRef<HTMLInputElement>(null);
  const field = (k: Typed) => ({
    inputMode: "decimal" as const, autoComplete: "off", value: s[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: e.target.value })),
  });

  useEffect(() => {
    if (!draftKey || s === start) return;
    try { if (s === initial) storage()?.removeItem(draftKey); else storage()?.setItem(draftKey, JSON.stringify(s)); } catch { /* storage full or blocked */ }
  }, [s, start, initial, draftKey]);

  const setUber = (on: boolean) => {
    setS((p) => ({ ...p, uberOn: on, uberCost: !on ? "0" : Number(p.uberCost.replace(",", ".")) > 0 ? p.uberCost : Number(defaultUberCost) > 0 ? defaultUberCost : "" }));
    if (on) requestAnimationFrame(() => uberInput.current?.focus());
  };

  const out = useMemo(() => {
    const built = toPricingInput(s);
    if ("error" in built) return { error: built.error };
    try { return { r: calculatePrice(built.input) }; } catch (e) {
      if (e instanceof PricingError) return { error: e.message };
      throw e;
    }
  }, [s]);

  const r = out.r;
  const quoteHref = r ? `/orcamentos/novo?${new URLSearchParams({ preco: r.finalPrice, custo: r.totalCost, uber: r.uberCharge })}` : "#";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem] lg:items-start">
      <section className="card card-pad grid gap-5" aria-label="Dados da simulação">
        <div className="grid gap-3">
          <h2>Quanto você gasta</h2>
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <Field name="partCost" label="Peça (R$)"><Input {...field("partCost")} placeholder="0,00" enterKeyHint="next" /></Field>
            <Field name="laborCost" label="Sua mão de obra (R$)"><Input {...field("laborCost")} placeholder="0,00" enterKeyHint="next" /></Field>
          </div>
        </div>

        <div className="grid gap-3">
          <h2>Quanto você quer ganhar</h2>
          <Field name="markupPct" label="Margem de lucro (%)" hint="Calculada sobre o custo (markup). Com 60%, um custo de R$ 218,00 vira R$ 348,80.">
            <Input {...field("markupPct")} />
          </Field>
        </div>

        <div className="grid items-start gap-3 min-[400px]:grid-cols-2">
          <YesNo legend="Uber" name="uberOn" value={s.uberOn} onChange={setUber} />
          <div className="field">
            <label className="field">
              <span className="label">Valor do Uber (R$)</span>
              <input ref={uberInput} className="input" {...field("uberCost")} value={s.uberOn ? s.uberCost : "0,00"} disabled={!s.uberOn} aria-describedby="calc-uber-hint" />
            </label>
            <p className="hint" id="calc-uber-hint">{s.uberOn ? "Somado ao preço, sem markup: o cliente repõe o que você gastou." : "Sem Uber nesta conta."}</p>
          </div>
        </div>
        {s !== initial && <button type="button" className="btn btn-quiet btn-sm !min-h-11 justify-self-start" onClick={() => setS(initial)}>Limpar conta</button>}
      </section>

      <section className="grid gap-4 lg:sticky lg:top-4" aria-label="Resultado">
        {out.error && <p role="alert" className="chip chip-bad !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">{out.error}</p>}
        {r && (
          <div className="hero grid gap-5 p-5">
            <div aria-live="polite">
              <p className="text-sm text-white">O cliente paga</p>
              <p className="num text-[2.5rem] font-bold leading-tight text-white">{brl(r.finalPrice)}</p>
            </div>
            <dl className="grid gap-2.5 border-t border-white/20 pt-4 text-[0.9375rem]">
              <Row k="Preço de venda" v={brl(r.suggestedPrice)} />
              {s.uberOn && <Row k="Uber" v={brl(r.uberCharge)} />}
              <Row k="Você gasta" v={brl(r.totalCost)} />
              <Row k="Lucro total" v={brl(r.profit)} strong />
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
