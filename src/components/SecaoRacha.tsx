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
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1.5">
        {titulo}
      </h3>
      {nota && (
        <p className="text-[11px] font-mono text-giz-fraco mb-2.5">
          {nota}
        </p>
      )}
      {children}
    </section>
  );
}
