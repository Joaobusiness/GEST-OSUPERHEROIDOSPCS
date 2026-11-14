"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form";
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

export function LogoCard({ current, isAdmin }: { current: string; isAdmin: boolean }) {
  const [logo, setLogo] = useState(current);
  const [err, setErr] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setErr("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setErr("Use uma imagem PNG, JPG ou WebP."); return; }
    try { const d = await shrink(file); setLogo(d); if (hidden.current) hidden.current.value = d; }
    catch (e) { setErr(e instanceof Error ? e.message : "Não consegui ler essa imagem."); }
  };
  return (
    <section className="card card-pad grid gap-4">
      <div>
        <h2>Logo da empresa</h2>
        <p className="hint mt-1">Aparece no topo do PDF do orçamento. PNG, JPG ou WebP.</p>
      </div>
      <ActionForm action={updateLogoAction}>
        <input ref={hidden} type="hidden" name="logo" defaultValue={current} />
        <div className="flex h-28 items-center justify-center overflow-hidden rounded-[var(--r-md)] border border-dashed border-[var(--line)] bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="Prévia do logo" className="h-auto max-h-[5.5rem] w-auto max-w-full object-contain" /> : <p className="text-sm text-[var(--text-2)]">Nenhum logo ainda</p>}
        </div>
        {err && <p role="alert" className="err">{err}</p>}
        {isAdmin && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="btn btn-quiet cursor-pointer sm:col-span-1">
              <ImageUp size={18} aria-hidden /> Escolher imagem
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <SubmitButton>Salvar logo</SubmitButton>
            {logo && (
              <button type="submit" className="btn btn-quiet" onClick={() => { if (hidden.current) hidden.current.value = ""; setLogo(""); }}>
                <Trash2 size={18} aria-hidden /> Remover logo
              </button>
            )}
          </div>
        )}
      </ActionForm>
    </section>
  );
}
