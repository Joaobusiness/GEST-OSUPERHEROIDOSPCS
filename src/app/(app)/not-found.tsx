import Link from "next/link";
import { Empty } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function AppNotFound() {
  return (
    <div className="pt-4">
      <Empty title="Não encontramos isso" text="O registro não existe, foi removido ou o endereço está errado." href="/" cta="Voltar ao início" />
      <p className="mt-3 text-center text-[0.9375rem]"><Link href="/clientes" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">Ver clientes</Link></p>
    </div>
  );
}
