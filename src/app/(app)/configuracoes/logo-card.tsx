"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { ActionForm } from "@/components/form";
import { updateLogoAction } from "@/server/settings-actions";

const MAX_SIDE = 480;
const MAX_CHARS = 300_000;

/** Shrinks the picked image to at most 480px and returns a data URL under ~300KB. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const png = c.toDataURL("image/png");
  if (png.length <= MAX_CHARS) return png;
  // heavy photo: flatten on white and compress
  const f = document.createElement("canvas"); f.width = c.width; f.height = c.height;
  const g = f.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, f.width, f.height); g.drawImage(c, 0, 0);
  for (const q of [0.9, 0.8, 0.65, 0.5]) { const j = f.toDataURL("image/jpeg", q); if (j.length <= MAX_CHARS) return j; }
  throw new Error("Imagem pesada demais. Tente outra.");
}

function Picker({ onPick }: { onPick: (f?: File) => void }) {
  const { pending } = useFormStatus();
  return (
    <label className="btn btn-primary btn-sm max-[420px]:w-full cursor-pointerfocus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]" aria-busy={pending}>
      {pending ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Enviando…</> : "Mudar logo"}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}

/** Perfil no estilo Instagram: logo + nome + "Mudar logo". Escolher a imagem já salva; não existe botão separado. */
export function ProfileCard({ current, name, email, isAdmin }: { current: string; name: string; email: string; isAdmin: boolean }) {
  const [logo, setLogo] = useState(current);
  const [prev, setPrev] = useState(current);
  if (prev !== current) { setPrev(current); setLogo(current); }
  const [err, setErr] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const send = (v: string) => { if (hidden.current) { hidden.current.value = v; hidden.current.form?.requestSubmit(); } };
  const pick = async (file?: File) => {
    if (!file) return;
    setErr("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setErr("Use uma imagem PNG, JPG ou WebP."); return; }
    try { const d = await shrink(file); setLogo(d); send(d); }
    catch (e) { setErr(e instanceof Error ? e.message : "Não consegui ler essa imagem."); }
  };
  return (
    <ActionForm action={updateLogoAction}>
      <input ref={hidden} type="hidden" name="logo" defaultValue={current} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--r-lg)] bg-[var(--card)] p-4 shadow-[var(--shadow-1)]">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--line)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="Logo da empresa" className="size-full object-contain p-1" /> : <span aria-hidden className="text-2xl font-bold text-[var(--accent)]">{name.trim().charAt(0).toUpperCase() || "?"}</span>}
        </div>
        <div className="min-w-[10rem] flex-1">
          <p className="truncate text-lg font-bold">{name}</p>
          <p className="truncate text-sm text-[var(--text-2)]">{email}</p>
          {isAdmin && logo && <button type="button" className="mt-1 min-h-11 text-sm font-semibold text-[var(--bad)]" onClick={() => { setLogo(""); send(""); }}>Remover logo</button>}
        </div>
        {isAdmin && <Picker onPick={(f) => void pick(f)} />}
      </div>
      {!logo && <p className="hint">O logo aparece no topo do PDF do orçamento. PNG, JPG ou WebP.</p>}
      {err && <p role="alert" className="err">{err}</p>}
    </ActionForm>
  );
}
