"use client";

import { Plus, Trash2 } from "lucide-react";
import { money } from "@/components/ui";
import { dec, markupOf, markupPrice, type Line } from "@/server/line-items";

export const blankLine = (kind: Line["kind"] = "LABOR"): Line => ({ kind, description: "", quantity: "1", unitCost: "0", unitPrice: "0" });

const pct = (s: string) => s.replace(".", ",");

/**
 * One list of lines (serviços or produtos). The parent merges lists into the hidden `items` field.
 * Type cost and selling price: the line shows profit and markup over cost (green or red), and one tap applies
 * the ideal price = cost x (1 + default markup/100).
 */
export function ItemsEditor({ items, onChange, kind, addLabel, placeholder, defaultMarkup }: {
  items: Line[]; onChange: (next: Line[]) => void; kind: Line["kind"]; addLabel: string; placeholder: string; defaultMarkup: string;
}) {
  const set = (i: number, patch: Partial<Line>) => onChange(items.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const cell = "input !min-w-0 !px-2.5";
  const select = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(); // the first key replaces "0" instead of appending to it
  return (
    <div>
      <ul>
        {items.map((l, i) => {
          const cost = dec(l.unitCost), price = dec(l.unitPrice);
          const profit = price.minus(cost).times(dec(l.quantity)).toDecimalPlaces(2);
          const ideal = cost.gt(0) ? markupPrice(l.unitCost, defaultMarkup) : null;
          return (
            <li key={i} className="grid gap-2 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0">
              <input className="input" aria-label="Descrição" value={l.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={200} placeholder={placeholder} enterKeyHint="next" />
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
                <label className="field"><span className="label">Qtd.</span>
                  <input className={cell} inputMode="decimal" autoComplete="off" value={l.quantity} onFocus={select} onChange={(e) => set(i, { quantity: e.target.value })} />
                </label>
                <label className="field"><span className="label">Custo (R$)</span>
                  <input className={cell} inputMode="decimal" autoComplete="off" enterKeyHint="next" value={l.unitCost} onFocus={select} onChange={(e) => set(i, { unitCost: e.target.value })} />
                </label>
                <label className="field"><span className="label">Venda (R$)</span>
                  <input className={cell} inputMode="decimal" autoComplete="off" value={l.unitPrice} onFocus={select} onChange={(e) => set(i, { unitPrice: e.target.value })} />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" aria-live="polite">
                {cost.gt(0) ? (
                  <p className={`chip num ${profit.gt(0) ? "chip-ok" : profit.lt(0) ? "chip-bad" : ""}`}>
                    {profit.lt(0) ? "Prejuízo" : "Lucro"} {money(profit.abs())} · {pct(markupOf(l.unitCost, l.unitPrice))}%
                  </p>
                ) : <span />}
                <p className="num font-semibold" aria-label="Subtotal da linha">{money(dec(l.quantity).times(price).toDecimalPlaces(2))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ideal && !price.eq(ideal) && (
                  <button type="button" className="btn btn-quiet btn-sm num !px-3" onClick={() => set(i, { unitPrice: ideal })}>
                    Usar preço ideal: {money(ideal)} <span className="font-normal text-[var(--text-2)]">({pct(defaultMarkup)}%)</span>
                  </button>
                )}
                <button type="button" className="btn btn-quiet btn-sm !px-3" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={`Remover linha ${i + 1}${l.description ? `: ${l.description}` : ""}`}>
                  <Trash2 size={16} aria-hidden /> Remover
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => onChange([...items, blankLine(kind)])}><Plus size={18} aria-hidden /> {addLabel}</button>
    </div>
  );
}
