import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTenant } from "../../tests/helpers";
import { ForbiddenError, UserError, addMember, listTeam, removeMember, updatePricingSettings, pricingSchema, type Ctx } from "./settings";

async function setup() {
  const { tenantId, db } = await makeTenant("cfg");
  const admin = await prisma.user.create({ data: { email: `a-${tenantId}@t.local`, name: "Admin", passwordHash: "x", memberships: { create: { tenantId, role: "ADMIN" } } } });
  const ctx = (role: "ADMIN" | "MEMBER", userId = admin.id): Ctx => ({ db, tenantId, role, userId });
  return { tenantId, admin, ctx };
}

const settings = pricingSchema.parse({
  partMarginPct: "35", laborMarginPct: "50", minMarginPct: "15", cardFeePct: "4", taxPct: "6",
  defaultUberCost: "10", otherCostsFixed: "0", defaultUberMode: "SEPARATE", uberMarkup: "on", inactiveDays: "90",
});

describe("settings", () => {
  it("MEMBER cannot change settings or team; ADMIN can", async () => {
    const { tenantId, ctx } = await setup();
    await expect(updatePricingSettings(ctx("MEMBER"), settings)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addMember(ctx("MEMBER"), { name: "X", email: "x@t.local", password: "12345678" })).rejects.toBeInstanceOf(ForbiddenError);
    await updatePricingSettings(ctx("ADMIN"), settings);
    const st = await prisma.pricingSettings.findUniqueOrThrow({ where: { tenantId } });
    expect(st.partMarginPct.toString()).toBe("35");
    expect(st.defaultUberMode).toBe("SEPARATE");
  });

  it("the last ADMIN cannot be removed; a member can, and the account is deleted", async () => {
    const { admin, ctx } = await setup();
    await expect(removeMember(ctx("ADMIN"), admin.id)).rejects.toBeInstanceOf(UserError);
    const id = await addMember(ctx("ADMIN"), { name: "Membro", email: `m-${admin.id}@t.local`, password: "12345678" });
    expect(await listTeam(ctx("ADMIN"))).toHaveLength(2);
    await removeMember(ctx("ADMIN"), id);
    expect(await listTeam(ctx("ADMIN"))).toHaveLength(1);
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
  });
});
