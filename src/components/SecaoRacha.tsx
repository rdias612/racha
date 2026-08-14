import type { ReactNode } from "react";

interface SecaoRachaProps {
  titulo: string;
  nota?: string;
  children: ReactNode;
}

// Wrapper genérico para seções da página de Estatísticas do Racha.
// Cada nova estatística (duplas, sequências, coeficientes...) vira uma SecaoRacha.
export function SecaoRacha({ titulo, nota, children }: SecaoRachaProps) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
        {titulo}
      </h3>
      {nota && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-1 mb-2">
          {nota}
        </p>
      )}
      {children}
    </section>
  );
}
