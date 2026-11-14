import { describe, expect, it } from "vitest";
import { moneyStr, pctStr } from "@/lib/action";
import { itemsField } from "@/server/line-items";

describe("numeric input caps (would overflow numeric columns and 500)", () => {
  it("moneyStr", () => {
    expect(moneyStr.safeParse("9999999999.99").success).toBe(true);
    expect(moneyStr.safeParse("99999999999").success).toBe(false);
    expect(moneyStr.safeParse("1".repeat(500)).success).toBe(false);
  });
  it("pctStr", () => {
    expect(pctStr.safeParse("100").success).toBe(true);
    expect(pctStr.safeParse("1000").success).toBe(false);
  });
  it("item quantity and prices", () => {
    const row = (quantity: string, unitPrice: string) => JSON.stringify([{ kind: "PART", description: "x", quantity, unitCost: "0", unitPrice }]);
    expect(itemsField.safeParse(row("2", "10,50")).success).toBe(true);
    expect(itemsField.safeParse(row("999999999", "1")).success).toBe(false);
    expect(itemsField.safeParse(row("1", "-99999999999")).success).toBe(false);
  });
});

import { ymd } from "@/lib/action";
describe("ymd", () => {
  it("accepts real days only", () => {
    expect(ymd().safeParse("2026-02-28").success).toBe(true);
    expect(ymd().safeParse("2026-13-45").success).toBe(false);
    expect(ymd().safeParse("2026-02-31").success).toBe(false);
  });
});

describe("ymd range", () => {
  it("rejects years Postgres or the UI cannot hold", () => {
    expect(ymd().safeParse("0000-01-01").success).toBe(false);
    expect(ymd().safeParse("2026-11-14").success).toBe(true);
  });
});
