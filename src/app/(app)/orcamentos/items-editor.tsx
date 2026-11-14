"use client";

import { Plus, Trash2 } from "lucide-react";
import { money } from "@/components/ui";
import { dec, type Line } from "@/server/line-items";

export const blankLine = (kind: Line["kind"] = "LABOR"): Line => ({ kind, description: "", quantity: "1", unitCost: "0", unitPrice: "0" });

/** One list of lines (serviços or produtos). The parent merges lists into the hidden `items` field. */
export function ItemsEditor({ items, onChange, kind, addLabel, placeholder }: {
  items: Line[]; onChange: (next: Line[]) => void; kind: Line["kind"]; addLabel: string; placeholder: string;
}) {
  const set = (i: number, patch: Partial<Line>) => onChange(items.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const cell = "input !min-w-0";
  return (
    <div>
      <ul>
        {items.map((l, i) => (
          <li key={i} className="grid gap-2 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0">
            <input className="input" aria-label="Descrição" value={l.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={200} placeholder={placeholder} />
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
              <label className="field"><span className="label">Qtd.</span>
                <input className={cell} inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
              </label>
              <label className="field"><span className="label">Valor unit. (R$)</span>
                <input className={cell} inputMode="decimal" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} />
              </label>
              <p className="num pb-3 text-right font-semibold" aria-label="Subtotal da linha">{money(dec(l.quantity).times(dec(l.unitPrice)).toDecimalPlaces(2))}</p>
            </div>
            <details className="text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center text-[var(--text-2)]">Meu custo (só eu vejo)</summary>
              <label className="field mb-1"><span className="label">Custo unitário (R$)</span>
                <input className={cell} inputMode="decimal" value={l.unitCost} onChange={(e) => set(i, { unitCost: e.target.value })} />
              </label>
            </details>
            <button type="button" className="btn btn-quiet btn-sm justify-self-start" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={`Remover linha ${i + 1}`}>
              <Trash2 size={16} aria-hidden /> Remover
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => onChange([...items, blankLine(kind)])}><Plus size={18} aria-hidden /> {addLabel}</button>
    </div>
  );
}
