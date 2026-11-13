"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action";

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Salvando…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <><Loader2 size={18} className="animate-spin" aria-hidden /> {pendingText}</> : children}
    </button>
  );
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Form wired to a server action. Shows a top-level error/success message and
 * passes per-field errors to <Field name=...> through the data-errors attribute.
 */
export function ActionForm({ action, children, className = "grid gap-4", resetOnSuccess = false, onSuccessHref }: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; onSuccessHref?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok && onSuccessHref) window.location.assign(onSuccessHref);
  }, [state, resetOnSuccess, onSuccessHref]);
  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    f.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
      const msg = state.fieldErrors?.[el.dataset.field!];
      const input = el.querySelector<HTMLElement>("input,textarea,select");
      input?.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg && input) { // replay the shake from a clean baseline
        input.classList.remove("is-shaking");
        void input.offsetWidth;
        input.classList.add("is-shaking");
      }
      const slot = el.querySelector<HTMLElement>("[data-err]");
      if (slot) slot.textContent = msg ?? "";
    });
    if (state.error) f.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {state.error && <p role="alert" className="t-toast-in chip chip-bad !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="t-toast-in chip chip-ok !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">{state.message}</p>}
      {children}
    </form>
  );
}

export function Field({ name, label, hint, children }: { name: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field" data-field={name}>
      <label className="field">
        <span className="label">{label}</span>
        {children}
      </label>
      {hint && <p className="hint">{hint}</p>}
      <p className="err" data-err aria-live="polite" />
    </div>
  );
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="input" {...p} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className="input" {...p} />;
