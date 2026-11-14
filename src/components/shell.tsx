"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ADMIN_ITEM, NAV } from "@/lib/nav";

const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function SideNav({ admin = false }: { admin?: boolean }) {
  const path = usePathname();
  const items = admin ? [...NAV, ADMIN_ITEM] : NAV;
  return (
    <nav aria-label="Principal" className="grid gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const on = active(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-[var(--r-md)] px-3.5 text-[0.9375rem] font-medium transition-colors ${on ? "bg-[var(--ink-line)] text-white" : "text-[var(--on-ink-2)] hover:bg-white/5 hover:text-white"}`}>
            <Icon size={20} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const path = usePathname();
  const tabs = NAV.filter((n) => n.tab);
  const inMore = !tabs.some((t) => active(path, t.href));
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ink-line)] bg-[var(--ink)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium ${on ? "text-[var(--glow)]" : "text-[var(--on-ink-2)]"}`}>
                <Icon size={22} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/mais" aria-current={inMore ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium ${inMore ? "text-[var(--glow)]" : "text-[var(--on-ink-2)]"}`}>
            <Menu size={22} aria-hidden /> Mais
          </Link>
        </li>
      </ul>
    </nav>
  );
}
