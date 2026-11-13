import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui";
import { requireSuperAdmin } from "@/server/auth";
import { logoutAction } from "@/server/auth-actions";

export const metadata = { title: "Administração da plataforma" };

const LINKS = [{ href: "/admin", label: "Empresas" }, { href: "/admin/planos", label: "Planos" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  return (
    <div className="min-h-dvh">
      <header className="bg-[var(--ink)] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[var(--on-ink)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/admin" aria-label="Administração"><Logo height={44} /></Link>
          <form action={logoutAction}>
            <button className="flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-3 text-sm font-medium text-[var(--on-ink-2)] hover:bg-white/5 hover:text-white">
              <LogOut size={18} aria-hidden /> <span className="max-w-[10rem] truncate">{user.email}</span>
            </button>
          </form>
        </div>
        <nav aria-label="Administração" className="mx-auto flex max-w-5xl gap-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-[var(--r-md)] px-3 text-[0.9375rem] font-medium text-[var(--on-ink-2)] hover:bg-white/5 hover:text-white">{l.label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
