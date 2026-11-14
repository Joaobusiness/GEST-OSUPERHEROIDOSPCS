"use client";

import { useEffect } from "react";

/** Registra o SW de assets estáticos (public/sw.js). Só em produção; falha silenciosa, o app funciona sem. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
