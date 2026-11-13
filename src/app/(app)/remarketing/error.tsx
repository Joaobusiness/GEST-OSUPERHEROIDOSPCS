"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card card-pad grid justify-items-center gap-2 py-10 text-center" role="alert">
      <h2>Não foi possível carregar</h2>
      <p className="max-w-[40ch] text-[0.9375rem] text-[var(--text-2)]">Algo deu errado ao buscar os dados. Seus dados continuam salvos.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-2">Tentar de novo</button>
    </div>
  );
}
