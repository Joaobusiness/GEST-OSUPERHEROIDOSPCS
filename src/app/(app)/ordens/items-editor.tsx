"use client";

import { Plus, Trash2 } from "lucide-react";
import { money } from "@/components/ui";
import { dec, type Line } from "@/server/line-items";

export const blankLine = (kind: Line["kind"] = "PART"): Line => ({ kind, description: "", quantity: "1", unitCost: "0", unitPrice: "0" });

const KINDS = { PART: "Peça", LABOR: "Mão de obra", OTHER: "Outro" } as const;

/** Controlled list of items. Shared by orders and quotes; the parent serializes `items` into a hidden field. */
export function ItemsEditor({ items, onChange }: { items: Line[]; onChange: (next: Line[]) => void }) {
  const set = (i: number, patch: Partial<Line>) => onChange(items.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  return (
    <div data-field="items">
      <ul>
        {items.map((l, i) => (
          <li key={i} className="grid gap-2 border-t border-[var(--line)] py-4 first:border-t-0 first:pt-0">
            <label className="field"><span className="label">Descrição</span>
              <input className="input" value={l.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={200} placeholder="Ex.: SSD 480 GB" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="field"><span className="label">Tipo</span>
                <select className="input" value={l.kind} onChange={(e) => set(i, { kind: e.target.value as Line["kind"] })}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field"><span className="label">Quantidade</span>
                <input className="input" inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
              </label>
              <label className="field"><span className="label">Custo unitário</span>
                <input className="input" inputMode="decimal" value={l.unitCost} onChange={(e) => set(i, { unitCost: e.target.value })} />
              </label>
              <label className="field"><span className="label">Preço unitário</span>
                <input className="input" inputMode="decimal" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="num font-semibold">{money(dec(l.quantity).times(dec(l.unitPrice)).toDecimalPlaces(2))}</p>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={`Remover item ${i + 1}`}>
                <Trash2 size={16} aria-hidden /> Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => onChange([...items, blankLine()])}><Plus size={18} aria-hidden /> Adicionar item</button>
      <p className="err mt-2" data-err aria-live="polite" />
    </div>
  );
}
