"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

const sub = (cb: () => void) => {
  addEventListener("online", cb); addEventListener("offline", cb);
  return () => { removeEventListener("online", cb); removeEventListener("offline", cb); };
};

/** Avisa quando a conexão cai. Ações enviadas offline falham, então o aviso evita perda de trabalho silenciosa. */
export function OfflineBanner() {
  const online = useSyncExternalStore(sub, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <p role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-[var(--warn-soft)] px-4 py-2 text-center text-sm font-medium text-[var(--warn)]">
      <WifiOff size={16} aria-hidden /> Sem internet. O que você digitou fica na tela; salve quando voltar.
    </p>
  );
}
