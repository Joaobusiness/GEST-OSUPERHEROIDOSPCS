"use client";

import { useState } from "react";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { saveDebtAction } from "@/server/crm-actions";

/** "Cliente está devendo?": off saves at once (and the customer leaves the dashboard list); on shows value and agreed date. */
export function DebtCard({ id, owes, amount, dueDate }: { id: string; owes: boolean; amount: string; dueDate: string }) {
  const [on, setOn] = useState(owes);
  const [value, setValue] = useState(amount);
  const [date, setDate] = useState(dueDate);
  return (
    <section className="card card-pad mt-4 grid gap-3" aria-label="Cliente devendo">
      <ActionForm action={saveDebtAction} className="grid gap-3">
        <input type="hidden" name="id" value={id} />
        {on && <input type="hidden" name="owes" value="on" />}
        <div className="flex items-center justify-between gap-3">
          <span id="debt-label" className="font-semibold">Cliente está devendo?</span>
          <button
            type="button" role="switch" aria-checked={on} aria-labelledby="debt-label"
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--bad)]" : "bg-[var(--line)] ring-1 ring-inset ring-[var(--text-3)]"}`}
            onClick={(e) => {
              const next = !on;
              setOn(next);
              if (!next) {
                setValue(""); setDate("");
                const f = e.currentTarget.closest("form");
                if (f) setTimeout(() => f.requestSubmit(), 0); // turning it off saves at once
              }
            }}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-7" : "left-1"}`} />
            <span className="absolute -inset-2" aria-hidden />
          </button>
        </div>
        {on && (
          <>
            <div className="grid gap-3 min-[400px]:grid-cols-2">
              <Field name="amount" label="Valor devido (R$)"><Input name="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
              <Field name="dueDate" label="Data combinada"><Input name="dueDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <SubmitButton className="btn btn-quiet">Salvar</SubmitButton>
          </>
        )}
      </ActionForm>
    </section>
  );
}
