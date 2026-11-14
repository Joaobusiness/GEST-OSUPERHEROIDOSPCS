import Link from "next/link";
import { LogOut } from "lucide-react";
import { SideNav, TabBar } from "@/components/shell";
import { Logo } from "@/components/ui";
import { OfflineBanner } from "@/components/offline-banner";
import { requireAuth } from "@/server/auth";
import { logoutAction } from "@/server/auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { tenant, user } = await requireAuth();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17rem_1fr]">
      <aside className="hidden bg-[var(--ink)] p-4 text-[var(--on-ink)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overscroll-contain">
        <Link href="/" aria-label="Início"><Logo height={72} /></Link>
        <SideNav admin={user.isSuperAdmin} />
        <div className="mt-auto grid shrink-0 gap-2 border-t border-[var(--ink-line)] pt-4">
          <div className="min-w-0 px-1"><p className="truncate font-semibold">{tenant.name}</p><p className="truncate text-sm text-[var(--on-ink-2)]">{user.email}</p></div>
          <form action={logoutAction}><button className="flex min-h-11 w-full items-center gap-2 rounded-[var(--r-md)] px-3 text-sm font-medium text-[var(--on-ink-2)] hover:bg-white/5 hover:text-white"><LogOut size={18} aria-hidden /> Sair</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <OfflineBanner />
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[var(--ink)] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[var(--on-ink)] lg:hidden">
          <Link href="/" aria-label="Início"><Logo height={44} /></Link>
          <p className="min-w-0 truncate text-sm font-medium text-[var(--on-ink-2)]">{tenant.name}</p>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 lg:px-8 lg:pt-8">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
