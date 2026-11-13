import Decimal from "decimal.js";

// Money is always Decimal, rounded half-up to cents only at the output edge.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type UberMode = "INCLUDED" | "SEPARATE" | "ABSORBED";
type N = Decimal.Value;

export interface PricingInput {
  partCost?: N;
  laborCost?: N; // what the work costs the business
  laborPrice?: N | null; // fixed sell price for labor; when set, it is not marked up
  otherCosts?: N;
  fixedFees?: N; // fixed fees are added to cost before the formula
  uberCost?: N;
  uberMode?: UberMode;
  uberMarkup?: boolean; // SEPARATE only: false = pure pass-through
  marginPct: N; // margin on selling price, 0..100
  taxPct?: N; // % of selling price
  cardFeePct?: N; // % of selling price
  manualPrice?: N | null; // overrides the customer total; margin is recomputed
}

export interface PricingResult {
  totalCost: string; // every cost the business bears, uber included when it bears it
  suggestedPrice: string; // price of the job without a separate uber line
  uberCharge: string; // separate uber line shown to the customer ("0.00" otherwise)
  finalPrice: string; // what the customer pays
  feesPct: string; // tax + card fee, % of selling price
  feesAmount: string;
  profit: string;
  effectiveMarginPct: string;
  logisticsCost: string;
  belowMinMargin?: boolean;
}

export class PricingError extends Error {}

const d = (v: N | null | undefined) => new Decimal(v ?? 0);
const money = (v: Decimal) => v.toDecimalPlaces(2).toFixed(2);

/** price = cost / (1 - (margin + fees)/100). Throws when the denominator is <= 0. */
export function priceFromCost(cost: Decimal, marginPct: Decimal, feesPct: Decimal): Decimal {
  const denom = new Decimal(1).minus(marginPct.plus(feesPct).div(100));
  if (denom.lte(0)) {
    throw new PricingError("Margem + taxas devem ser menores que 100%.");
  }
  return cost.div(denom);
}

export function calculatePrice(input: PricingInput, minMarginPct?: N): PricingResult {
  const margin = d(input.marginPct);
  const tax = d(input.taxPct);
  const card = d(input.cardFeePct);
  const fees = tax.plus(card);
  const uber = d(input.uberCost);
  const mode = input.uberMode ?? "INCLUDED";
  for (const [k, v] of Object.entries({ margin, tax, card, uber })) {
    if (v.isNeg()) throw new PricingError(`Valor negativo não permitido: ${k}.`);
  }

  const laborFixed = input.laborPrice != null && input.laborPrice !== "";
  const labor = d(input.laborCost);
  // INCLUDED: uber is cost inside the marked-up price. ABSORBED: bears cost, never charged.
  const base = d(input.partCost).plus(d(input.otherCosts)).plus(d(input.fixedFees));
  const markedUpCost = base.plus(laborFixed ? 0 : labor).plus(mode === "INCLUDED" ? uber : 0);

  let suggested = priceFromCost(markedUpCost, margin, fees);
  if (laborFixed) suggested = suggested.plus(d(input.laborPrice));

  let uberCharge = new Decimal(0);
  if (mode === "SEPARATE" && uber.gt(0)) {
    uberCharge = input.uberMarkup ? priceFromCost(uber, margin, fees) : uber.div(new Decimal(1).minus(fees.div(100)));
    // pass-through still recovers the % fees charged on it, otherwise fees would eat the repass
  }

  const totalCost = base.plus(labor).plus(uber);
  const computedFinal = suggested.plus(uberCharge);
  const finalPrice = input.manualPrice != null && input.manualPrice !== "" ? d(input.manualPrice) : computedFinal;
  const feesAmount = finalPrice.times(fees).div(100);
  const profit = finalPrice.minus(feesAmount).minus(totalCost);
  const effective = finalPrice.isZero() ? new Decimal(0) : profit.div(finalPrice).times(100);

  return {
    totalCost: money(totalCost),
    suggestedPrice: money(suggested),
    uberCharge: money(uberCharge),
    finalPrice: money(finalPrice),
    feesPct: fees.toDecimalPlaces(2).toFixed(2),
    feesAmount: money(feesAmount),
    profit: money(profit),
    effectiveMarginPct: effective.toDecimalPlaces(2).toFixed(2),
    logisticsCost: money(uber),
    belowMinMargin: minMarginPct != null ? effective.lt(d(minMarginPct)) : undefined,
  };
}

export const brl = (v: N) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(new Decimal(v).toNumber());
