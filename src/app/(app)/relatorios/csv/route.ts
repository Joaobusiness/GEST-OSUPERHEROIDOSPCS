import { requireAuth } from "@/server/auth";
import { resolvePeriod, transactionsCsv } from "@/server/finance";

export async function GET(req: Request) {
  const { db, tenant, role } = await requireAuth();
  if (role !== "ADMIN") return new Response("Apenas o administrador pode exportar.", { status: 403 });
  const q = new URL(req.url).searchParams;
  const period = resolvePeriod({ p: q.get("p") ?? undefined, de: q.get("de") ?? undefined, ate: q.get("ate") ?? undefined }, tenant.timezone);
  return new Response(await transactionsCsv(db, period, tenant.timezone), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lancamentos-${period.from}-${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
