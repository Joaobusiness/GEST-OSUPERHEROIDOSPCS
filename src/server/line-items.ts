// Pure money math shared by orders, quotes and their client forms (no db, no server-only).
import Decimal from "decimal.js";
import { z } from "zod";
import { legacyPriceFromMargin, priceFromMarkup, type UberMode } from "@/lib/pricing";

/** Largest value the Decimal(12,2) columns hold. */
export const MAX_MONEY = new Decimal("9999999999.99");

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
const amount = z.string().transform(norm).refine((s) => /^\d{1,8}(\.\d{1,2})?$/.test(s), "Valor inválido nos itens.");
// a negative unit price is a discount line (created when a quote with discount becomes an order)
const signed = z.string().transform(norm).refine((s) => /^-?\d{1,10}(\.\d{1,2})?$/.test(s), "Valor inválido nos itens.");

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

/**
 * Uber line the customer pays. Current rule: Uber "Sim" = SEPARATE, the amount typed is passed through.
 * INCLUDED / ABSORBED / uberMarkup only exist on quotes saved before the Sim/Não change and keep their old math.
 * `marginPct` is the quote's stored snapshot; it only matters for those legacy uberMarkup quotes.
 */
export function uberCharge(u: UberInput, r: Rates): Decimal {
  const uber = dec(u.uberCost);
  if (u.uberMode !== "SEPARATE" || uber.lte(0)) return new Decimal(0);
  const fees = dec(r.taxPct).plus(dec(r.cardFeePct));
  return (u.uberMarkup ? legacyPriceFromMargin(uber, dec(r.marginPct), fees) : uber.div(new Decimal(1).minus(fees.div(100)))).toDecimalPlaces(2);
}

export function quoteTotals(items: Line[], u: UberInput, r: Rates, discount: Decimal.Value, extraFee: Decimal.Value) {
  const sub = itemsTotal(items);
  const uber = uberCharge(u, r);
  // customer pays items + separate uber - discount + fee; the business bears every cost once, uber included
  const totalAmount = sub.plus(uber).minus(dec(discount)).plus(dec(extraFee));
  const totalCost = itemsCost(items).plus(dec(u.uberCost));
  return { itemsTotal: sub, uberCharge: uber, totalAmount, totalCost };
}

/** Unit price from unit cost and markup over cost: 218 at 60% = 348.80. */
export const markupPrice = (unitCost: Decimal.Value, markupPct: Decimal.Value) =>
  priceFromMarkup(dec(unitCost), dec(markupPct)).toDecimalPlaces(2).toFixed(2);

/** Markup a line carries today, derived from its cost and price ("" when there is no cost to compare). */
export const markupOf = (unitCost: Decimal.Value, unitPrice: Decimal.Value) =>
  dec(unitCost).gt(0) ? dec(unitPrice).div(dec(unitCost)).minus(1).times(100).toDecimalPlaces(2).toString() : "";
