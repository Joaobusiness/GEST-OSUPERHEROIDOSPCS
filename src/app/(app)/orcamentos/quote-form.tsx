"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { money } from "@/components/ui";
import { dec, quoteTotals, suggestPrices, type Line } from "@/server/line-items";
import { saveQuoteAction } from "@/server/quotes-actions";
import { ItemsEditor, blankLine } from "../ordens/items-editor";

export type QuoteFormProps = {
  customers: { id: string; name: string }[];
  orders: { id: string; number: string; customerId: string }[];
  settings: { partMarginPct: string; laborMarginPct: string; taxPct: string; cardFeePct: string };
  initial: {
    id?: string; customerId: string; serviceOrderId: string; items: Line[]; discount: string; extraFee: string;
    uberMode: "INCLUDED" | "SEPARATE" | "ABSORBED"; uberCost: string; uberMarkup: boolean;
    validUntil: string; executionDays: string; paymentTerms: string; warranty: string; notes: string;
  };
  revisesDecided?: boolean;
};

export function QuoteForm({ customers, orders, settings, initial, revisesDecided }: QuoteFormProps) {
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [items, setItems] = useState<Line[]>(initial.items.length ? initial.items : [blankLine()]);
  const [discount, setDiscount] = useState(initial.discount);
  const [extraFee, setExtraFee] = useState(initial.extraFee);
  const [uberMode, setUberMode] = useState(initial.uberMode);
  const [uberCost, setUberCost] = useState(initial.uberCost);
  const [uberMarkup, setUberMarkup] = useState(initial.uberMarkup);
  const [hint, setHint] = useState("");

  const rates = { marginPct: settings.partMarginPct, taxPct: settings.taxPct, cardFeePct: settings.cardFeePct };
  const uber = { uberMode, uberCost, uberMarkup };
  const t = quoteTotals(items, uber, rates, discount, extraFee);
  const profit = t.totalAmount.minus(t.totalAmount.times(dec(settings.taxPct).plus(settings.cardFeePct)).div(100)).minus(t.totalCost);
  const customerOrders = orders.filter((o) => o.customerId === customerId);

  const suggest = () => {
    try { setItems(suggestPrices(items, settings, uber)); setHint("Preços sugeridos a partir dos custos e das margens da Precificação. Ajuste se precisar."); }
    catch (e) { setHint(e instanceof Error ? e.message : "Não foi possível sugerir."); }
  };

  return (
    <ActionForm action={saveQuoteAction} className="grid gap-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {revisesDecided && <p className="chip chip-warn !rounded-[var(--r-md)] !px-3 !py-2 !text-sm" role="note">Este orçamento já foi decidido. Salvar cria uma nova revisão e mantém a anterior como está.</p>}

      <section className="card card-pad grid gap-4">
        <h2>Cliente</h2>
        <Field name="customerId" label="Cliente">
          <Select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="" disabled>Escolha</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field name="serviceOrderId" label="OS vinculada (opcional)">
          <Select name="serviceOrderId" defaultValue={initial.serviceOrderId} key={customerId}>
            <option value="">Sem OS</option>
            {customerOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
          </Select>
        </Field>
      </section>

      <section className="card card-pad grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2>Itens</h2>
          <button type="button" className="btn btn-quiet btn-sm" onClick={suggest}><Sparkles size={16} aria-hidden /> Sugerir preço</button>
        </div>
        {hint && <p className="hint" role="status">{hint}</p>}
        <ItemsEditor items={items} onChange={setItems} />
      </section>

      <section className="card card-pad grid gap-4">
        <h2>Deslocamento (Uber)</h2>
        <Field name="uberMode" label="Como cobrar">
          <Select name="uberMode" value={uberMode} onChange={(e) => setUberMode(e.target.value as typeof uberMode)}>
            <option value="INCLUDED">Incluso no preço dos itens</option>
            <option value="SEPARATE">Linha separada para o cliente</option>
            <option value="ABSORBED">Eu absorvo o custo</option>
          </Select>
        </Field>
        <Field name="uberCost" label="Custo do Uber (R$)"><Input name="uberCost" inputMode="decimal" value={uberCost} onChange={(e) => setUberCost(e.target.value)} /></Field>
        {uberMode === "SEPARATE" && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="uberMarkup" checked={uberMarkup} onChange={(e) => setUberMarkup(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span>Aplicar margem sobre o Uber <span className="hint block">Desligado: o cliente só repõe o custo e as taxas.</span></span>
          </label>
        )}
      </section>

      <section className="card card-pad grid gap-4">
        <h2>Condições</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field name="discount" label="Desconto (R$)"><Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
          <Field name="extraFee" label="Taxa extra (R$)"><Input name="extraFee" inputMode="decimal" value={extraFee} onChange={(e) => setExtraFee(e.target.value)} /></Field>
          <Field name="validUntil" label="Válido até"><Input type="date" name="validUntil" defaultValue={initial.validUntil} /></Field>
          <Field name="executionDays" label="Prazo (dias)"><Input name="executionDays" inputMode="numeric" defaultValue={initial.executionDays} /></Field>
        </div>
        <Field name="paymentTerms" label="Pagamento"><Input name="paymentTerms" defaultValue={initial.paymentTerms} placeholder="Ex.: Pix na entrega ou cartão em até 3x" /></Field>
        <Field name="warranty" label="Garantia"><Input name="warranty" defaultValue={initial.warranty} placeholder="Ex.: 90 dias nas peças e no serviço" /></Field>
        <Field name="notes" label="Observações"><Textarea name="notes" defaultValue={initial.notes} /></Field>
      </section>

      <section className="card card-pad grid gap-2" aria-label="Resumo do orçamento" aria-live="polite">
        <Row label="Itens" value={money(t.itemsTotal)} />
        {uberMode === "SEPARATE" && <Row label="Deslocamento" value={money(t.uberCharge)} />}
        {dec(discount).gt(0) && <Row label="Desconto" value={`- ${money(dec(discount))}`} />}
        {dec(extraFee).gt(0) && <Row label="Taxa extra" value={money(dec(extraFee))} />}
        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="font-semibold">Cliente paga</span><span className="num text-2xl font-bold">{money(t.totalAmount)}</span>
        </div>
        <Row label="Custo total" value={money(t.totalCost)} />
        <Row label="Lucro estimado (após impostos e taxa de cartão)" value={money(profit)} tone={profit.isNeg() ? "bad" : "ok"} />
      </section>
      <SubmitButton>Salvar orçamento</SubmitButton>
    </ActionForm>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
      <span className="text-[var(--text-2)]">{label}</span>
      <span className={`num font-semibold ${tone === "bad" ? "text-[var(--bad)]" : tone === "ok" ? "text-[var(--ok)]" : ""}`}>{value}</span>
    </p>
  );
}
