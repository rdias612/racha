import type { ReactNode } from "react";

interface CarregandoProps {
  children: string;
  className?: string;
  compacto?: boolean;
}

export function Carregando({
  children,
  className = "",
  compacto = false,
}: CarregandoProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-auto w-full max-w-2xl space-y-3 px-3 py-4 sm:px-4 ${className}`}
    >
      <span className="sr-only">{children}</span>
      {compacto ? (
        <div className="h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      ) : (
        <>
          <div className="h-6 w-2/5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </>
      )}
    </div>
  );
}

type MensagemEstadoProps = {
  children: ReactNode;
  tipo?: "erro" | "sucesso" | "info";
  className?: string;
};

export function MensagemEstado({
  children,
  tipo = "erro",
  className = "",
}: MensagemEstadoProps) {
  const sucesso = tipo === "sucesso";
  const informativa = tipo === "info";

  return (
    <div
      role={sucesso || informativa ? "status" : "alert"}
      aria-live="polite"
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        sucesso
          ? "border-green-600/30 bg-green-500/10 text-green-700 dark:border-green-400/30 dark:text-green-300"
          : informativa
            ? "border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            : "border-red-600/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:text-red-300"
      } ${className}`}
    >
      {children}
    </div>
  );
}