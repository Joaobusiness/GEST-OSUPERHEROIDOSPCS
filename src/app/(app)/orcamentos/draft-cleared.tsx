"use client";

import { useEffect } from "react";
import { clearDraft } from "./draft";

/** Rendered once after a successful save: drops that draft and removes the marker from the URL, so Back never clears a newer draft. */
export function DraftCleared({ draftKey, href }: { draftKey: string; href: string }) {
  useEffect(() => {
    try { clearDraft(window.localStorage, draftKey); } catch { /* storage blocked: there was no draft */ }
    window.history.replaceState(null, "", href);
  }, [draftKey, href]);
  return null;
}
