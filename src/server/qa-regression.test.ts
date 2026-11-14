import { describe, expect, it, vi } from "vitest";
import { makeCustomer, makeTenant } from "../../tests/helpers";

const { onQuoteApproved, onQuoteCanceled } = vi.hoisted(() => ({ onQuoteApproved: vi.fn(), onQuoteCanceled: vi.fn() }));
vi.mock("./finance", () => ({ onQuoteApproved, onQuoteCanceled, createReceivable: vi.fn(), registerPayment: vi.fn() }));
import { approveQuote, cancelQuote, saveQuote } from "./quotes";
import { CrmError, getCustomer } from "./crm";
import { getCampaign } from "./remarketing";

const input = (customerId: string) => ({
  customerId, discount: "0", extraFee: "0", uberMode: "INCLUDED" as const, uberCost: "0", uberMarkup: false,
  items: [{ kind: "LABOR" as const, description: "Formatar", quantity: "1", unitCost: "0", unitPrice: "80" }],
});

describe("QA regressions", () => {
  it("approve is retryable after the finance step failed", async () => {
    const t = await makeTenant("R"); const c = await makeCustomer(t.db);
    const { quote } = await saveQuote(t.db, t.tenantId, null, input(c.id));
    onQuoteApproved.mockRejectedValueOnce(new Error("boom"));
    await expect(approveQuote(t.db, quote.id, "WhatsApp")).rejects.toThrow("boom");
    await approveQuote(t.db, quote.id, "WhatsApp"); // retry must not hit "status não permite"
    expect(onQuoteApproved).toHaveBeenCalledTimes(2);
  });
  it("cancel is retryable after the finance step failed", async () => {
    const t = await makeTenant("R"); const c = await makeCustomer(t.db);
    const { quote } = await saveQuote(t.db, t.tenantId, null, input(c.id));
    await approveQuote(t.db, quote.id, "WhatsApp");
    onQuoteCanceled.mockRejectedValueOnce(new Error("boom"));
    await expect(cancelQuote(t.db, quote.id)).rejects.toThrow("boom");
    onQuoteCanceled.mockClear();
    await cancelQuote(t.db, quote.id);
    expect(onQuoteCanceled).toHaveBeenCalledTimes(1);
  });
  it("non-uuid ids give CrmError (404), not a Prisma 500", async () => {
    const t = await makeTenant("R");
    await expect(getCustomer(t.db, "abc")).rejects.toBeInstanceOf(CrmError);
    await expect(getCampaign(t.db, "abc")).rejects.toBeInstanceOf(CrmError);
  });
});
