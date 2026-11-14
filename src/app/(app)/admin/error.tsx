"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card card-pad grid justify-items-center gap-3 py-10 text-center" role="alert">
      <h2>Não foi possível carregar esta tela</h2>
      <p className="max-w-[40ch] text-[0.9375rem] text-[var(--text-2)]">Tente de novo. Se o problema continuar, volte em alguns minutos.</p>
      <button type="button" onClick={reset} className="btn btn-primary">Tentar de novo</button>
    </div>
  );
}
