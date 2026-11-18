"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FileText, MessageSquareText, Package, Percent, Route, UserRound, Wrench, ClipboardList } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea, YesNo } from "@/components/form";
import { money } from "@/components/ui";
import { dec, itemsTotal, quoteTotals, type Line } from "@/server/line-items";
import { saveQuoteAction } from "@/server/quotes-actions";
import { clearDraft, filled, restoreDraft, saveDraft, type QuoteDraftData, type Seeded } from "./draft";
import { ItemsEditor, blankLine } from "./items-editor";

export type QuoteFormProps = {
  customers: { id: string; name: string }[];
  settings: { markupPct: string; defaultUberCost: string; taxPct: string; cardFeePct: string };
  initial: {
    id?: string; customerId: string; items: Line[]; discount: string; extraFee: string;
    uberMode: "INCLUDED" | "SEPARATE" | "ABSORBED"; uberCost: string; uberMarkup: boolean;
    validUntil: string; executionDays: string; paymentTerms: string; warranty: string; notes: string;
  };
  revisesDecided?: boolean;
  /** localStorage key of this form's draft, already scoped by company, user and quote. */
  draftKey: string;
  /** updatedAt of the saved quote ("" when new): a draft made against another version is discarded. */
  base: string;
  /** Query string that prefilled the form ("" when none) and what it carried. */
  seed: string;
  seeded: Seeded;
};

const isProduct = (l: Line) => l.kind === "PART";
const LEGACY_UBER = { INCLUDED: "o Uber fica dentro do preço dos itens, sem linha própria", ABSORBED: "você paga o Uber e não cobra do cliente", SEPARATE: "o Uber é cobrado com lucro em cima" };

function toData(i: QuoteFormProps["initial"]): QuoteDraftData {
  const services = i.items.filter((l) => !isProduct(l));
  const products = i.items.filter(isProduct);
  return {
    customerId: i.customerId, services: services.length || products.length ? services : [blankLine("LABOR")], products,
    discount: i.discount, extraFee: i.extraFee, uberOn: dec(i.uberCost).gt(0), uberCost: i.uberCost,
    notes: i.notes, validUntil: i.validUntil, executionDays: i.executionDays, paymentTerms: i.paymentTerms, warranty: i.warranty,
  };
}

const storage = () => { try { return window.localStorage; } catch { return null; } }; // blocked storage: the form works without drafts
const noSubscribe = () => () => {};

function Card({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad grid gap-4">
      <h2 className="flex items-center gap-2 !text-[0.8125rem] font-bold uppercase tracking-wide text-[var(--text-2)]"><Icon size={16} aria-hidden /> {title}</h2>
      {children}
    </section>
  );
}

/** Reads the draft once, after hydration, and mounts the form already filled with it (no flash of the empty form on in-app navigation). */
export function QuoteForm(p: QuoteFormProps) {
  const read = useRef<ReturnType<typeof restoreDraft> | undefined>(undefined);
  const draft = useSyncExternalStore(
    noSubscribe,
    () => (read.current === undefined ? (read.current = restoreDraft(storage(), p.draftKey, p.base, p.seed, p.seeded)) : read.current),
    () => null,
  );
  return <Form key={draft ? "draft" : "clean"} {...p} draft={draft} />;
}

function Form({ customers, settings, initial, revisesDecided, draftKey, base, seed, draft }: QuoteFormProps & { draft: ReturnType<typeof restoreDraft> }) {
  const [f, setF] = useState<QuoteDraftData>(() => (draft ? { ...toData(initial), ...draft.data } : toData(initial)));
  const [untouched, setUntouched] = useState(f); // the state that is not worth saving: what the server sent, or the draft as restored
  const [restored, setRestored] = useState(!!draft);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editTotal, setEditTotal] = useState<string | null>(null); // text typed in "Editar valor"; null = closed
  const uberInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<QuoteDraftData>) => setF((p) => ({ ...p, ...patch }));

  // Every change is written at once (no debounce: a closed tab must not lose the last keystroke).
  useEffect(() => {
    if (f !== untouched) saveDraft(storage(), draftKey, base, draft?.seed ?? seed, f);
  }, [f, untouched, draftKey, base, seed, draft]);

  const discard = () => {
    clearDraft(storage(), draftKey);
    const clean = toData(initial);
    setF(clean); setUntouched(clean); setRestored(false); setConfirmDiscard(false);
  };

  // Quotes saved before Uber became Sim/Não keep the rule they were saved with; new ones always charge the amount typed as its own line.
  const legacy = !!initial.id && dec(initial.uberCost).gt(0) && (initial.uberMode !== "SEPARATE" || initial.uberMarkup);
  const uberMode = legacy ? initial.uberMode : "SEPARATE";
  const uberMarkup = legacy && initial.uberMarkup;
  const uberCost = f.uberOn ? f.uberCost : "0";

  const setUber = (on: boolean) => {
    set({ uberOn: on, uberCost: !on ? "0" : dec(f.uberCost).gt(0) ? f.uberCost : dec(settings.defaultUberCost).gt(0) ? settings.defaultUberCost : "" });
    if (on) requestAnimationFrame(() => uberInput.current?.focus());
  };

  const items = [...f.services, ...f.products];
  const rates = { marginPct: settings.markupPct, taxPct: settings.taxPct, cardFeePct: settings.cardFeePct };
  const t = quoteTotals(items, { uberMode, uberCost, uberMarkup }, rates, f.discount, f.extraFee);
  const profit = t.totalAmount.minus(t.totalCost);
  // "Editar valor": the typed final price becomes a discount (below the calculated total) or an extra fee (above it), so the saved quote and the profit stay consistent.
  const setFinal = (typed: string) => {
    setEditTotal(typed);
    if (typed.trim() === "") return;
    const gross = t.itemsTotal.plus(t.uberCharge), want = dec(typed);
    set(want.gte(gross) ? { discount: "0", extraFee: want.minus(gross).toFixed(2) } : { discount: gross.minus(want).toFixed(2), extraFee: "0" });
  };
  const text = (k: "notes" | "validUntil" | "executionDays" | "paymentTerms" | "warranty" | "discount" | "customerId") => ({
    name: k, value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set({ [k]: e.target.value }),
  });

  return (
    <ActionForm action={saveQuoteAction} className="mx-auto grid max-w-[700px] gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {/* untouched blank lines are not sent: a quote with only products must not fail on the empty service row */}
      <input type="hidden" name="items" value={JSON.stringify(items.filter(filled))} />
      <input type="hidden" name="extraFee" value={f.extraFee} />
      <input type="hidden" name="uberMode" value={uberMode} />
      <input type="hidden" name="uberCost" value={uberCost} />
      {uberMarkup && <input type="hidden" name="uberMarkup" value="on" />}
      {revisesDecided && <p className="chip chip-warn !rounded-[var(--r-md)] !px-3 !py-2 !text-sm" role="note">Este orçamento já foi decidido. Salvar cria uma nova revisão e mantém a anterior como está.</p>}
      {restored && (
        <div role="status" className="chip chip-accent !flex flex-wrap !justify-between !gap-x-3 !rounded-[var(--r-md)] !px-3 !py-1 !text-sm">
          <span className="py-2">Rascunho recuperado. Continue de onde parou.</span>
          <button type="button" className="min-h-11 font-bold underline" onClick={() => (confirmDiscard ? discard() : setConfirmDiscard(true))}>
            {confirmDiscard ? "Toque de novo para apagar" : "Descartar rascunho"}
          </button>
        </div>
      )}

      <Card icon={UserRound} title="Dados do cliente">
        <Field name="customerId" label="Cliente">
          <Select {...text("customerId")}>
            <option value="" disabled>Escolha o cliente</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Link href="/clientes/novo" className="inline-flex min-h-11 items-center justify-self-start font-semibold text-[var(--accent)]">Não achou? Novo cliente</Link>
      </Card>

      <Card icon={Wrench} title="Serviços">
        <ItemsEditor items={f.services} onChange={(services) => set({ services })} kind="LABOR" addLabel="Adicionar serviço" placeholder="Ex.: Formatação com backup" defaultMarkup={settings.markupPct} />
        <p className="flex justify-between border-t border-[var(--line)] pt-3 font-semibold"><span className="text-[var(--text-2)]">Subtotal</span><span className="num">{money(itemsTotal(f.services))}</span></p>
      </Card>

      <Card icon={Package} title="Produtos / peças">
        <ItemsEditor items={f.products} onChange={(products) => set({ products })} kind="PART" addLabel="Adicionar produto" placeholder="Ex.: SSD 480 GB" defaultMarkup={settings.markupPct} />
        <p className="flex justify-between border-t border-[var(--line)] pt-3 font-semibold"><span className="text-[var(--text-2)]">Subtotal</span><span className="num">{money(itemsTotal(f.products))}</span></p>
        <div data-field="items"><p className="err" data-err aria-live="polite" /></div>
      </Card>

      <Card icon={Route} title="Deslocamento">
        <div className="grid items-start gap-3 min-[460px]:grid-cols-2">
          <YesNo legend="Uber" name="uberOn" value={f.uberOn} onChange={setUber} />
          <div className="field" data-field="uberCost">
            <label className="field">
              <span className="label">Valor do Uber (R$)</span>
              <input ref={uberInput} className="input" inputMode="decimal" autoComplete="off" disabled={!f.uberOn} value={f.uberOn ? f.uberCost : "0,00"} onChange={(e) => set({ uberCost: e.target.value })} aria-describedby="uber-hint" />
            </label>
            <p className="hint" id="uber-hint">{!f.uberOn ? "Sem Uber neste orçamento." : legacy ? `Regra antiga deste orçamento: ${LEGACY_UBER[initial.uberMode]}.` : "Ida e volta. Entra no total como Deslocamento."}</p>
            <p className="err" data-err aria-live="polite" />
          </div>
        </div>
      </Card>

      <Card icon={Percent} title="Desconto">
        <Field name="discount" label="Valor do desconto (R$)"><Input inputMode="decimal" autoComplete="off" {...text("discount")} /></Field>
      </Card>

      <Card icon={MessageSquareText} title="Explicação do serviço">
        <Field name="notes" label="O que você vai explicar ao cliente" hint="Aparece no PDF."><Textarea rows={4} maxLength={2000} {...text("notes")} placeholder="Ex.: O notebook está lento por falta de memória. Vou trocar o SSD e reinstalar o Windows." /></Field>
      </Card>

      <Card icon={ClipboardList} title="Condições">
        <div className="grid gap-3 min-[460px]:grid-cols-2">
          <Field name="validUntil" label="Válido até"><Input type="date" {...text("validUntil")} /></Field>
          <Field name="executionDays" label="Prazo (dias)"><Input inputMode="numeric" autoComplete="off" {...text("executionDays")} /></Field>
        </div>
        <Field name="paymentTerms" label="Pagamento"><Input maxLength={500} {...text("paymentTerms")} placeholder="Ex.: Pix ou cartão em até 3x" /></Field>
        <Field name="warranty" label="Garantia"><Input maxLength={500} {...text("warranty")} placeholder="Ex.: 90 dias" /></Field>
      </Card>

      {/* Celular: o total real fica no fim de um formulário longo; esta faixa mantém o valor à vista enquanto preenche. */}
      <p aria-hidden className="card-ink sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.5rem)] z-20 -mt-1 flex items-baseline justify-between gap-3 !rounded-full px-5 py-2.5 lg:hidden">
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--on-ink-2)]">Total</span><span className="num text-xl font-bold">{money(t.totalAmount)}</span>
      </p>
      <section className="card-ink grid gap-3 p-5" aria-label="Total do orçamento">
        <div className="grid gap-3" aria-live="polite">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="text-sm font-bold uppercase tracking-wide text-[var(--on-ink-2)]">Total geral</span><span className="num text-3xl font-bold">{money(t.totalAmount)}</span></p>
          <dl className="grid gap-1.5 border-t border-[var(--ink-line)] pt-3 text-sm text-[var(--on-ink-2)]">
            {t.uberCharge.gt(0) && <div className="flex justify-between gap-3"><dt>Deslocamento (Uber)</dt><dd className="num">{money(t.uberCharge)}</dd></div>}
            <div className="flex justify-between gap-3"><dt>Seu custo</dt><dd className="num">{money(t.totalCost)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Lucro total (só eu)</dt><dd className={`num font-semibold ${profit.isNeg() ? "text-[var(--bad-on-ink)]" : "text-[var(--on-ink)]"}`}>{money(profit)}</dd></div>
          </dl>
        </div>
        {editTotal === null ? (
          <button type="button" className="min-h-11 justify-self-start text-sm font-semibold text-[var(--on-ink)] underline underline-offset-2" onClick={() => setEditTotal(t.totalAmount.toFixed(2).replace(".", ","))}>Editar valor</button>
        ) : (
          <div className="flex items-end gap-2">
            <label className="field min-w-0 flex-1"><span className="text-sm text-[var(--on-ink-2)]">Valor final (R$)</span>
              <input className="input" inputMode="decimal" autoComplete="off" autoFocus value={editTotal} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setFinal(e.target.value)} />
            </label>
            <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => setEditTotal(null)}>Pronto</button>
          </div>
        )}
        <SubmitButton className="btn btn-primary w-full"><FileText size={18} aria-hidden /> Gerar orçamento</SubmitButton>
        {f !== untouched && <p className="text-center text-[0.8125rem] text-[var(--on-ink-2)]">Rascunho salvo neste aparelho. Pode sair e voltar.</p>}
      </section>
    </ActionForm>
  );
}
