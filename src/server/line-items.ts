// Pure money math shared by orders, quotes and their client forms (no db, no server-only).
import Decimal from "decimal.js";
import { z } from "zod";
import { calculatePrice, type UberMode } from "@/lib/pricing";

export type Kind = "PART" | "LABOR" | "OTHER";
export type Line = { kind: Kind; description: string; quantity: string; unitCost: string; unitPrice: string };

/** "1.234,56" or "1234.56" or "" -> Decimal (invalid becomes 0; the server re-validates). */
export const dec = (s: Decimal.Value | null | undefined): Decimal => {
  if (s == null || s === "") return new Decimal(0);
  const t = typeof s === "string" ? (s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) : s;
  try { return new Decimal(t); } catch { return new Decimal(0); }
};

const lineTotal = (qty: Decimal.Value, price: Decimal.Value) => dec(qty).times(dec(price)).toDecimalPlaces(2);
export const itemsTotal = (items: Pick<Line, "quantity" | "unitPrice">[]) =>
  items.reduce((a, i) => a.plus(lineTotal(i.quantity, i.unitPrice)), new Decimal(0));
export const itemsCost = (items: Pick<Line, "quantity" | "unitCost">[]) =>
  items.reduce((a, i) => a.plus(lineTotal(i.quantity, i.unitCost)), new Decimal(0));

const norm = (s: string) => (s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
const amount = z.string().transform(norm).refine((s) => /^\d+(\.\d{1,2})?$/.test(s), "Valor inválido nos itens.");
// a negative unit price is a discount line (created when a quote with discount becomes an order)
const signed = z.string().transform(norm).refine((s) => /^-?\d+(\.\d{1,2})?$/.test(s), "Valor inválido nos itens.");

/** Zod schema for the JSON `items` form field. */
export const itemsField = z.preprocess((s) => { try { return JSON.parse(String(s || "[]")); } catch { return null; } },
  z.array(z.object({
    kind: z.enum(["PART", "LABOR", "OTHER"]),
    description: z.string().trim().min(1, "Descreva cada item.").max(200),
    quantity: amount.refine((s) => Number(s) > 0, "Quantidade deve ser maior que zero."),
    unitCost: amount,
    unitPrice: signed,
  }), "Itens inválidos.").max(100, "Itens demais."));

export type UberInput = { uberMode: UberMode; uberCost: Decimal.Value; uberMarkup: boolean };
export type Rates = { marginPct: Decimal.Value; taxPct: Decimal.Value; cardFeePct: Decimal.Value };

/** Separate uber line the customer pays (SEPARATE only). Derived, so it needs no column. */
export function uberCharge(u: UberInput, r: Rates): Decimal {
  if (u.uberMode !== "SEPARATE" || dec(u.uberCost).lte(0)) return new Decimal(0);
  return new Decimal(calculatePrice({ ...r, uberCost: dec(u.uberCost), uberMode: "SEPARATE", uberMarkup: u.uberMarkup }).uberCharge);
}

export function quoteTotals(items: Line[], u: UberInput, r: Rates, discount: Decimal.Value, extraFee: Decimal.Value) {
  const sub = itemsTotal(items);
  const uber = uberCharge(u, r);
  // customer pays items + separate uber - discount + fee; the business bears every cost once, uber included
  const totalAmount = sub.plus(uber).minus(dec(discount)).plus(dec(extraFee));
  const totalCost = itemsCost(items).plus(dec(u.uberCost));
  return { itemsTotal: sub, uberCharge: uber, totalAmount, totalCost };
}

/**
 * Suggests unit prices from costs with calculatePrice: parts/other use the part margin, labor the labor margin.
 * The group price (uber folded in when INCLUDED) is spread over its items in proportion to cost.
 * shortcut: spreads by cost ratio and rounds per unit, so totals can drift by a few cents; zero-cost items keep their price.
 */
export function suggestPrices(items: Line[], s: { partMarginPct: Decimal.Value; laborMarginPct: Decimal.Value; taxPct: Decimal.Value; cardFeePct: Decimal.Value }, u: UberInput): Line[] {
  const out = items.map((i) => ({ ...i }));
  const groups: Line[][] = [out.filter((i) => i.kind !== "LABOR"), out.filter((i) => i.kind === "LABOR")];
  let uberUsed = false;
  groups.forEach((g, gi) => {
    const cost = itemsCost(g);
    if (cost.lte(0)) return;
    const carry = !uberUsed; uberUsed = true;
    const r = calculatePrice({
      [gi === 0 ? "partCost" : "laborCost"]: cost, marginPct: gi === 0 ? s.partMarginPct : s.laborMarginPct,
      taxPct: s.taxPct, cardFeePct: s.cardFeePct,
      uberCost: carry ? dec(u.uberCost) : 0, uberMode: u.uberMode, uberMarkup: u.uberMarkup,
    });
    for (const i of g) {
      const c = lineTotal(i.quantity, i.unitCost);
      if (c.lte(0)) continue;
      i.unitPrice = new Decimal(r.suggestedPrice).times(c).div(cost).div(dec(i.quantity)).toDecimalPlaces(2).toFixed(2);
    }
  });
  return out;
}
