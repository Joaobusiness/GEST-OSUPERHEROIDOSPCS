"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { money } from "@/components/ui";
import { itemsTotal, type Line } from "@/server/line-items";
import { saveItemsAction } from "@/server/orders-actions";
import { ItemsEditor } from "./items-editor";

export function OrderItemsForm({ id, initial, locked }: { id: string; initial: Line[]; locked: boolean }) {
  const [items, setItems] = useState<Line[]>(initial);
  if (locked) return <p className="text-[0.9375rem] text-[var(--text-2)]">OS encerrada. Reabra para alterar os itens.</p>;
  return (
    <ActionForm action={saveItemsAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <ItemsEditor items={items} onChange={setItems} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-[var(--text-2)]">Total <span className="num text-lg font-bold text-[var(--text)]">{money(itemsTotal(items))}</span></p>
        <SubmitButton>Salvar itens</SubmitButton>
      </div>
    </ActionForm>
  );
}
