"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, MessageSquareText, Package, Percent, Route, UserRound, Wrench, ClipboardList } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { money } from "@/components/ui";
import { itemsTotal, quoteTotals, type Line } from "@/server/line-items";
import { saveQuoteAction } from "@/server/quotes-actions";
import { ItemsEditor, blankLine } from "./items-editor";

export type QuoteFormProps = {
  customers: { id: string; name: string }[];
  settings: { partMarginPct: string; laborMarginPct: string; taxPct: string; cardFeePct: string };
  initial: {
    id?: string; customerId: string; items: Line[]; discount: string; extraFee: string;
    uberMode: "INCLUDED" | "SEPARATE" | "ABSORBED"; uberCost: string; uberMarkup: boolean;
    validUntil: string; executionDays: string; paymentTerms: string; warranty: string; notes: string;
  };
  revisesDecided?: boolean;
};

const isProduct = (l: Line) => l.kind === "PART";

function Card({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad grid gap-4">
      <h2 className="flex items-center gap-2 !text-[0.8125rem] font-bold uppercase tracking-wide text-[var(--text-2)]"><Icon size={16} aria-hidden /> {title}</h2>
      {children}
    </section>
  );
}

export function QuoteForm({ customers, settings, initial, revisesDecided }: QuoteFormProps) {
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [services, setServices] = useState<Line[]>(() => {
    const l = initial.items.filter((i) => !isProduct(i));
    return l.length || initial.items.some(isProduct) ? l : [blankLine("LABOR")];
  });
  const [products, setProducts] = useState<Line[]>(() => initial.items.filter(isProduct));
  const [discount, setDiscount] = useState(initial.discount);
  const [extraFee] = useState(initial.extraFee);
  const [uberMode, setUberMode] = useState(initial.uberMode);
  const [uberCost, setUberCost] = useState(initial.uberCost);
  const [uberMarkup, setUberMarkup] = useState(initial.uberMarkup);

  const items = [...services, ...products];
  const rates = { marginPct: settings.partMarginPct, taxPct: 0, cardFeePct: 0 };
  const t = quoteTotals(items, { uberMode, uberCost, uberMarkup }, rates, discount, extraFee);
  const profit = t.totalAmount.minus(t.totalCost);

  return (
    <ActionForm action={saveQuoteAction} className="mx-auto grid max-w-[700px] gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="extraFee" value={extraFee} />
      {revisesDecided && <p className="chip chip-warn !rounded-[var(--r-md)] !px-3 !py-2 !text-sm" role="note">Este orçamento já foi decidido. Salvar cria uma nova revisão e mantém a anterior como está.</p>}

      <Card icon={UserRound} title="Dados do cliente">
        <Field name="customerId" label="Cliente">
          <Select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="" disabled>Escolha o cliente</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Link href="/clientes/novo" className="inline-flex min-h-11 items-center justify-self-start font-semibold text-[var(--accent)]">Não achou? Novo cliente</Link>
      </Card>

      <Card icon={Wrench} title="Serviços">
        <ItemsEditor items={services} onChange={setServices} kind="LABOR" addLabel="Adicionar serviço" placeholder="Ex.: Formatação com backup" />
        <p className="flex justify-between border-t border-[var(--line)] pt-3 font-semibold"><span className="text-[var(--text-2)]">Subtotal</span><span className="num">{money(itemsTotal(services))}</span></p>
      </Card>

      <Card icon={Package} title="Produtos / peças">
        <ItemsEditor items={products} onChange={setProducts} kind="PART" addLabel="Adicionar produto" placeholder="Ex.: SSD 480 GB" />
        <p className="flex justify-between border-t border-[var(--line)] pt-3 font-semibold"><span className="text-[var(--text-2)]">Subtotal</span><span className="num">{money(itemsTotal(products))}</span></p>
        <p className="err" data-field="items" data-err aria-live="polite" />
      </Card>

      <Card icon={Route} title="Deslocamento">
        <div className="grid gap-3 min-[460px]:grid-cols-2">
          <Field name="uberCost" label="Custo do Uber (R$)" hint="Ida e volta."><Input name="uberCost" inputMode="decimal" value={uberCost} onChange={(e) => setUberCost(e.target.value)} /></Field>
          <Field name="uberMode" label="Como cobrar">
            <Select name="uberMode" value={uberMode} onChange={(e) => setUberMode(e.target.value as typeof uberMode)}>
              <option value="INCLUDED">Dentro do preço</option>
              <option value="SEPARATE">Linha separada</option>
              <option value="ABSORBED">Eu pago, não cobro</option>
            </Select>
          </Field>
        </div>
        {uberMode === "SEPARATE" && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="uberMarkup" checked={uberMarkup} onChange={(e) => setUberMarkup(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span>Colocar lucro no Uber <span className="hint block">Desligado: o cliente só repõe o que você gastou.</span></span>
          </label>
        )}
      </Card>

      <Card icon={Percent} title="Desconto">
        <Field name="discount" label="Valor do desconto (R$)"><Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
      </Card>

      <Card icon={MessageSquareText} title="Explicação do serviço">
        <Field name="notes" label="O que você vai explicar ao cliente" hint="Aparece no PDF."><Textarea name="notes" rows={4} defaultValue={initial.notes} placeholder="Ex.: O notebook está lento por falta de memória. Vou trocar o SSD e reinstalar o Windows." /></Field>
      </Card>

      <Card icon={ClipboardList} title="Condições">
        <div className="grid gap-3 min-[460px]:grid-cols-2">
          <Field name="validUntil" label="Válido até"><Input type="date" name="validUntil" defaultValue={initial.validUntil} /></Field>
          <Field name="executionDays" label="Prazo (dias)"><Input name="executionDays" inputMode="numeric" defaultValue={initial.executionDays} /></Field>
        </div>
        <Field name="paymentTerms" label="Pagamento"><Input name="paymentTerms" defaultValue={initial.paymentTerms} placeholder="Ex.: Pix ou cartão em até 3x" /></Field>
        <Field name="warranty" label="Garantia"><Input name="warranty" defaultValue={initial.warranty} placeholder="Ex.: 90 dias" /></Field>
      </Card>

      <section className="card-ink grid gap-3 p-5" aria-label="Total do orçamento" aria-live="polite">
        <p className="flex items-baseline justify-between gap-3"><span className="text-sm font-bold uppercase tracking-wide text-[var(--on-ink-2)]">Total geral</span><span className="num text-3xl font-bold">{money(t.totalAmount)}</span></p>
        <p className="flex items-baseline justify-between gap-3 border-t border-[var(--ink-line)] pt-3 text-sm text-[var(--on-ink-2)]">
          <span>Seu lucro estimado (só você vê)</span><span className={`num font-semibold ${profit.isNeg() ? "text-[var(--bad)]" : ""}`}>{money(profit)}</span>
        </p>
        <SubmitButton className="btn btn-primary w-full"><FileText size={18} aria-hidden /> Gerar orçamento</SubmitButton>
      </section>
    </ActionForm>
  );
}
