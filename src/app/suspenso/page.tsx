import { logoutAction } from "@/server/auth-actions";
import { Logo } from "@/components/ui";

export const metadata = { title: "Conta suspensa" };

export default function SuspendedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--ink)] px-4 text-[var(--on-ink)]">
      <div className="grid max-w-sm justify-items-center gap-4 text-center">
        <Logo height={80} />
        <h1>Conta suspensa</h1>
        <p className="text-[var(--on-ink-2)]">O acesso desta assistência está suspenso. Fale com o suporte da plataforma para regularizar.</p>
        <form action={logoutAction}><button className="btn btn-quiet">Sair</button></form>
      </div>
    </main>
  );
}
