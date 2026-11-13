import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Super Herói dos PCs", template: "%s · Super Herói dos PCs" },
  description: "Gestão de assistência técnica: clientes, ordens de serviço, orçamentos, preço certo e financeiro.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a0c10" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
