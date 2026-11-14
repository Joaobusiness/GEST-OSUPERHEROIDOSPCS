"use client";

export default function RootError({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <main role="alert" className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Essa página não abriu</h1>
      <p className="text-[var(--text-2)]">Seus dados estão guardados. Veja se a internet está boa e tente de novo.</p>
      <button type="button" onClick={() => unstable_retry()} className="btn btn-primary mt-2">Tentar de novo</button>
    </main>
  );
}
