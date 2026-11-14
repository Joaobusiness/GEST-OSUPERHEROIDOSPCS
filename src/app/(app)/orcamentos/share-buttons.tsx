"use client";

import { MessageCircle, Printer } from "lucide-react";
import { markSentAction } from "@/server/quotes-actions";

/** Opens WhatsApp with the prepared text and marks a draft as sent. */
export function WhatsAppButton({ href, quoteId, markSent }: { href: string; quoteId: string; markSent: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-primary" onClick={() => { if (markSent) void markSentAction(quoteId); }}>
      <MessageCircle size={18} aria-hidden /> Enviar pelo WhatsApp
    </a>
  );
}

export function PrintButton() {
  return <button type="button" className="btn btn-primary print:hidden" onClick={() => window.print()}><Printer size={18} aria-hidden /> Baixar PDF</button>;
}
