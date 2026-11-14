"use client";

// Último recurso: só roda quando o layout raiz quebra. Não pode depender de CSS/fonte do app.
export default function GlobalError({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, font: "16px system-ui, sans-serif", background: "#0a0c10", color: "#fff" }}>
        <main role="alert" style={{ minHeight: "100dvh", display: "grid", placeContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Algo deu errado</h1>
          <p style={{ margin: 0, color: "#b8bfcc", maxWidth: "40ch" }}>Seus dados estão guardados. Tente de novo; se continuar, volte em alguns minutos.</p>
          <button type="button" onClick={() => unstable_retry()} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#0a5cff", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Tentar de novo</button>
        </main>
      </body>
    </html>
  );
}
