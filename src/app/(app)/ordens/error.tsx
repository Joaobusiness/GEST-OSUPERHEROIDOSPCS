"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card card-pad grid justify-items-center gap-2 py-10 text-center" role="alert">
      <h2>Não foi possível carregar as ordens</h2>
      <p className="max-w-[40ch] text-[0.9375rem] text-[var(--text-2)]">Seus dados estão seguros. Tente de novo em instantes.</p>
      <button type="button" className="btn btn-primary mt-2" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
