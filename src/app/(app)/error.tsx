"use client";

export default function ErrorState({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <div role="alert" className="card card-pad mt-4 grid justify-items-center gap-2 py-10 text-center">
      <h2>Não foi possível carregar esta tela</h2>
      <p className="max-w-[40ch] text-[var(--text-2)]">Seus dados estão salvos. Verifique a conexão e tente de novo.</p>
      <button type="button" onClick={() => unstable_retry()} className="btn btn-primary mt-2">Tentar de novo</button>
    </div>
  );
}
