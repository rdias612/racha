import type { ReactNode } from "react";

interface SecaoRachaProps {
  titulo: string;
  children: ReactNode;
}

// Wrapper genérico para seções da página de Estatísticas do Racha.
// Cada nova estatística (duplas, sequências, coeficientes...) vira uma SecaoRacha.
export function SecaoRacha({ titulo, children }: SecaoRachaProps) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
