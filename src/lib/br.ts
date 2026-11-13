/** Brazilian input helpers: phone to E.164, CPF/CNPJ validation, WhatsApp link. */

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function toE164(raw: string): string | null {
  let d = onlyDigits(raw);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `+55${d}`;
}

export function formatPhone(e164: string): string {
  const d = onlyDigits(e164).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

function checkDigit(nums: number[], weights: number[]) {
  const sum = nums.reduce((a, n, i) => a + n * weights[i], 0);
  const r = (sum * 10) % 11;
  return r === 10 ? 0 : r;
}

export function isValidCpf(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  return (
    checkDigit(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] &&
    checkDigit(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10]
  );
}

export function isValidCnpj(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  return checkDigit(n.slice(0, 12), w1) === n[12] && checkDigit(n.slice(0, 13), w2) === n[13];
}

export const isValidDocument = (raw: string) => isValidCpf(raw) || isValidCnpj(raw);

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
}

/** Fills {nome_cliente}-style placeholders; unknown ones are left visible so the user notices. */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
