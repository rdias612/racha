interface MetricaComparativa {
  rotulo: string;
  valorA: number | null;
  valorB: number | null;
  /** True quando o menor valor é o melhor (ex.: gols contra). */
  menorMelhor?: boolean;
  /** Formatador opcional (percentual, média com decimal, em-dash). */
  exibir?: (valor: number | null) => string;
}

export type { MetricaComparativa };

function exibirValorMetrica(metrica: MetricaComparativa, valor: number | null): string {
  if (metrica.exibir) return metrica.exibir(valor);
  return String(valor ?? 0);
}

/** Linha da lista contínua comparativa: valor A | rótulo | valor B + barra. */
function LinhaComparativa({ metrica }: { metrica: MetricaComparativa }) {
  const { rotulo, valorA, valorB, menorMelhor = false } = metrica;

  let dominante: 'a' | 'b' | null = null;
  if (valorA !== null && valorB !== null && valorA !== valorB) {
    dominante = menorMelhor ? (valorA < valorB ? 'a' : 'b') : valorA > valorB ? 'a' : 'b';
  }

  const barraA = valorA ?? 0;
  const barraB = valorB ?? 0;
  const total = barraA + barraB;
  const percentualA = total > 0 ? (barraA / total) * 100 : 50;

  return (
    <div className="px-1 py-2.5 transition hover:bg-superficie-2/50">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums ${
            dominante === 'a' ? 'text-destaque-texto' : 'text-giz'
          }`}
        >
          {exibirValorMetrica(metrica, valorA)}
        </span>
        <span className="flex-1 text-center font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco">
          {rotulo}
        </span>
        <span
          className={`w-12 shrink-0 text-left font-mono text-sm font-bold tabular-nums ${
            dominante === 'b' ? 'text-destaque-texto' : 'text-giz'
          }`}
        >
          {exibirValorMetrica(metrica, valorB)}
        </span>
      </div>
      {/* Barra de domínio: preto = lado A, branco = lado B (contraste visual
          dos lados do comparativo, não a camisa de nenhum time). */}
      <div
        aria-hidden="true"
        className="mt-2 flex h-1.5 overflow-hidden rounded-[2px] border border-borda"
      >
        <div className="bg-preto-time" style={{ width: `${percentualA}%` }} />
        <div className="bg-branco-time" style={{ width: `${100 - percentualA}%` }} />
      </div>
    </div>
  );
}

/** Lista de métricas comparativas da temporada. */
export function SecaoMetricasComparador({ metricas }: { metricas: MetricaComparativa[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
        Números na Temporada
      </h3>
      <div className="divide-y divide-borda/40 border-y border-borda">
        {metricas.map((metrica) => (
          <LinhaComparativa key={metrica.rotulo} metrica={metrica} />
        ))}
      </div>
    </section>
  );
}
