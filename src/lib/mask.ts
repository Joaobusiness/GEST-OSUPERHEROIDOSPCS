// Input masks for BR fields. Pure; the server still validates and stores digits only (see br.ts).
const digits = (s: string) => s.replace(/\D/g, "");

/** (65) 99999-9999 or (65) 9999-9999. A pasted +55 prefix is dropped. */
export function maskPhone(v: string): string {
  let d = digits(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // DDD 55 exists, so only strip when too long
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const cut = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, cut)}-${d.slice(cut)}`;
}

/** CPF 000.000.000-00 up to 11 digits, CNPJ 00.000.000/0000-00 beyond. */
export function maskDocument(v: string): string {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11)
    return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

/** 00000-000 */
export function maskCep(v: string): string {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const MASKS = { phone: maskPhone, document: maskDocument, cep: maskCep } as const;
export type MaskName = keyof typeof MASKS;
