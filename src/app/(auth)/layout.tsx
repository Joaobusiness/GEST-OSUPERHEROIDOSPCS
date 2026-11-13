import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[var(--ink)] px-4 pb-10 pt-[max(2rem,env(safe-area-inset-top))] text-[var(--on-ink)] [--text:var(--on-ink)]">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <div className="rise flex justify-center"><Logo height={96} priority /></div>
        <div className="rise rise-2 rounded-[var(--r-lg)] bg-[var(--card)] p-6 text-[var(--text)] shadow-[var(--shadow-2)] [--text:#12151b]">
          {children}
        </div>
      </div>
    </main>
  );
}
