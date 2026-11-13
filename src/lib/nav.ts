import { Home, Users, Wrench, FileText, Calculator, Wallet, Megaphone, BarChart3, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; tab?: boolean };

export const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: Home, tab: true },
  { href: "/clientes", label: "Clientes", icon: Users, tab: true },
  { href: "/ordens", label: "Ordens de serviço", icon: Wrench, tab: true },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText, tab: true },
  { href: "/precificacao", label: "Precificação", icon: Calculator },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/remarketing", label: "Remarketing", icon: Megaphone },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
