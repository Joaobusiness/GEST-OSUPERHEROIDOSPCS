import Link from "next/link";
import { requireSuperAdmin } from "@/server/auth";

export const metadata = { title: "Administração" };

const LINKS = [{ href: "/admin", label: "Empresas" }, { href: "/admin/planos", label: "Planos" }];

/** Lives inside the app shell (menu, header). Only the platform owner gets past this; every page and action re-checks. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <>
      <nav aria-label="Administração" className="mb-4 flex gap-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn btn-quiet btn-sm">{l.label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}
