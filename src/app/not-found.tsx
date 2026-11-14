import Link from "next/link";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-[var(--text-2)]">O endereço não existe ou foi removido.</p>
      <Link href="/" className="btn btn-primary">Voltar ao início</Link>
    </main>
  );
}
