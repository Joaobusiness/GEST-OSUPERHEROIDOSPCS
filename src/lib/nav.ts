import { Home, Users, FileText, Calculator, Wallet, Megaphone, BarChart3, Settings, ShieldCheck, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; tab?: boolean };

export const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: Home, tab: true },
  { href: "/clientes", label: "Clientes", icon: Users, tab: true },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText, tab: true },
  { href: "/precificacao", label: "Precificação", icon: Calculator },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, tab: true },
  { href: "/remarketing", label: "Remarketing", icon: Megaphone },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

/** Only shown to the platform owner (isSuperAdmin); the pages re-check on the server. */
export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Administração", icon: ShieldCheck };
