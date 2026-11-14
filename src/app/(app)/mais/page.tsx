import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ADMIN_ITEM, NAV } from "@/lib/nav";
import { requireAuth } from "@/server/auth";
import { logoutAction } from "@/server/auth-actions";

export const metadata = { title: "Mais" };

export default async function MorePage() {
  const { user } = await requireAuth();
  const items = [...NAV.filter((n) => !n.tab), ...(user.isSuperAdmin ? [ADMIN_ITEM] : [])];
  return (
    <>
      <PageHeader title="Mais" />
      <nav aria-label="Outras áreas" className="card overflow-hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="list-row">
            <Icon size={22} aria-hidden className="text-[var(--accent)]" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight size={18} aria-hidden className="text-[var(--text-3)]" />
          </Link>
        ))}
      </nav>
      <form action={logoutAction} className="mt-4"><button className="btn btn-quiet w-full"><LogOut size={18} aria-hidden /> Sair</button></form>
    </>
  );
}
