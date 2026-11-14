"use client";

import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation first. For destructive or blocking actions. */
export function ConfirmButton({ message, children, className = "btn btn-danger btn-sm", label }: { message: string; children: React.ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-label={label} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
