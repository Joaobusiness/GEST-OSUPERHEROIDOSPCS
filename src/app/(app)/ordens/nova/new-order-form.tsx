"use client";

import { useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { createOrderAction } from "@/server/orders-actions";

type Customer = { id: string; name: string };
type Device = { id: string; customerId: string; label: string };

export function NewOrderForm({ customers, devices, categories, customerId: initial }: { customers: Customer[]; devices: Device[]; categories: string[]; customerId?: string }) {
  const [customerId, setCustomerId] = useState(initial ?? "");
  const [deviceId, setDeviceId] = useState("");
  const own = devices.filter((d) => d.customerId === customerId);
  const newCustomer = customerId === "";
  const newDevice = deviceId === "";
  return (
    <ActionForm action={createOrderAction} className="grid gap-5">
      <section className="card card-pad grid gap-4">
        <h2>Cliente</h2>
        <Field name="customerId" label="Cliente">
          <Select name="customerId" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setDeviceId(""); }}>
            <option value="">Novo cliente</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {newCustomer && (
          <>
            <Field name="newName" label="Nome do cliente"><Input name="newName" autoComplete="off" /></Field>
            <Field name="newPhone" label="WhatsApp ou telefone" hint="Com DDD."><Input name="newPhone" inputMode="tel" autoComplete="off" /></Field>
          </>
        )}
      </section>

      <section className="card card-pad grid gap-4">
        <h2>Equipamento</h2>
        {!newCustomer && own.length > 0 && (
          <Field name="deviceId" label="Equipamento">
            <Select name="deviceId" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">Novo equipamento</option>
              {own.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </Field>
        )}
        {(newCustomer || own.length === 0 || newDevice) && (
          <>
            <Field name="newCategory" label="Tipo"><Select name="newCategory" defaultValue={categories[0]}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field name="newBrand" label="Marca"><Input name="newBrand" autoComplete="off" /></Field>
              <Field name="newModel" label="Modelo"><Input name="newModel" autoComplete="off" /></Field>
            </div>
          </>
        )}
      </section>

      <section className="card card-pad grid gap-4">
        <h2>Atendimento</h2>
        <Field name="description" label="Problema relatado"><Textarea name="description" placeholder="O que o cliente disse que está acontecendo" /></Field>
        <Field name="estimatedDeliveryAt" label="Previsão de entrega"><Input type="date" name="estimatedDeliveryAt" /></Field>
      </section>
      <SubmitButton pendingText="Abrindo OS…">Abrir OS</SubmitButton>
    </ActionForm>
  );
}
