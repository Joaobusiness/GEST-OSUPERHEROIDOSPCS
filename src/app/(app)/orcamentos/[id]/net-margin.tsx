"use client";
import { useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valor que vou receber (após taxa do cartão) -> lucro e margem sobre o custo do orçamento. Não salva. */
export function NetMargin({ cost }: { cost: number }) {
  const [raw, setRaw] = useState("");
  const received = Number(raw.replace(/\./g, "").replace(",", "."));
  const ok = raw.trim() !== "" && Number.isFinite(received);
  const profit = received - cost;

  return (
    <section className="card card-pad grid gap-3" aria-label="Margem no cartão">
      <label className="field">
        <span className="label">Vou receber (R$)</span>
        <input className="input" inputMode="decimal" placeholder="497,12" value={raw} onChange={(e) => setRaw(e.target.value)} />
      </label>
      {ok && (
        <p className="flex items-baseline justify-between" aria-live="polite">
          <span className="text-[var(--text-2)]">Lucro{received > 0 ? ` (${((profit / received) * 100).toFixed(0)}%)` : ""}</span>
          <strong className="num text-2xl">{brl.format(profit)}</strong>
        </p>
      )}
    </section>
  );
}
