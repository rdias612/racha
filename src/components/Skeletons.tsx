/**
 * Componentes de Skeleton com geometria fiel aos componentes reais
 * para eliminar Cumulative Layout Shift (CLS) e prover carregamento fluido.
 */

export function SkeletonRanking() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando ranking..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto animate-pulse"
    >
      <span className="sr-only">Carregando ranking...</span>

      {/* Título */}
      <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md mb-3" />

      {/* Abas de métricas (4 botões) */}
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        <div className="flex-1 h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 min-w-[70px]" />
        <div className="flex-1 h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 min-w-[70px]" />
        <div className="flex-1 h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 min-w-[70px]" />
        <div className="flex-1 h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 min-w-[70px]" />
      </div>

      {/* Dropdown de posição */}
      <div className="mb-3 h-8 w-44 rounded-md bg-neutral-200 dark:bg-neutral-800" />

      {/* Slider de mínimo de partidas */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full" />
      </div>

      {/* Tabela de Ranking */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        {/* Header da Tabela */}
        <div className="h-9 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-3.5 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3.5 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3.5 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
        </div>

        {/* Linhas da Tabela */}
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-4 w-4 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="size-6 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                <div className="h-4 w-28 sm:w-36 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonJogos() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando jogos..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse"
    >
      <span className="sr-only">Carregando histórico de jogos...</span>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-44 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
          <div className="h-3.5 w-60 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>

      {/* Lista de cards de jogos */}
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 p-3.5 shadow-xs space-y-3"
          >
            {/* Linha de Data e Status */}
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
            </div>

            {/* Placar estilo estádio */}
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                <div className="h-3.5 w-10 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>

              <div className="h-10 w-24 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800" />

              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-10 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="size-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonEstatisticas() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando estatísticas..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5 animate-pulse"
    >
      <span className="sr-only">Carregando estatísticas e parcerias...</span>

      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        <div className="h-3.5 w-64 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>

      {/* Alternador de visualização (2 abas) */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        <div className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {/* Dropdown de jogador */}
      <div className="space-y-1">
        <div className="h-3 w-28 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-10 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {/* Números na Carreira */}
      <section>
        <div className="h-3.5 w-36 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-2.5 flex flex-col items-center justify-center gap-1.5 h-18"
            >
              <div className="h-6 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* Química & Parcerias */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-44 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="size-3.5 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>

        {/* Companheiros */}
        <div>
          <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="h-2.5 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-2 w-14 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="h-2.5 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-2 w-14 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Adversários */}
        <div>
          <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28" />
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28" />
          </div>
        </div>

        {/* Gols & Notas */}
        <div>
          <div className="h-3 w-40 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-24" />
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-24" />
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-24" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function SkeletonResumo() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando resumo..."
      className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl animate-pulse space-y-4"
    >
      <span className="sr-only">Carregando a resenha do ano...</span>

      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        </div>
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>

      {/* Card Próxima Partida */}
      <div className="h-24 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/40 p-4 flex flex-col justify-between" />

      {/* Grid de Destaques (6 cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3.5 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="size-4 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
              <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded mt-2" />
            </div>
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
              <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
