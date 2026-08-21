/**
 * Skeletons estruturais com Cumulative Layout Shift (CLS) = 0.
 * Espelham exatamente a hierarquia, espaçamento e dimensões dos componentes reais.
 */

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

export function SkeletonJogos() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando jogos..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse"
    >
      <span className="sr-only">Carregando lista de partidas...</span>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
          <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
      </div>

      {/* Filtro de Temporada */}
      <div className="h-9 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />

      {/* Lista de Jogos */}
      <div className="space-y-3 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
            </div>

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

export function SkeletonRanking() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando ranking..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse"
    >
      <span className="sr-only">Carregando classificação dos atletas...</span>

      {/* Header */}
      <div className="space-y-1">
        <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        <div className="h-3 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>

      {/* Abas de métricas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800"
          />
        ))}
      </div>

      {/* Slider de partidas mínimas */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 space-y-2">
        <div className="flex justify-between">
          <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full" />
      </div>

      {/* Linhas de Jogadores */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="size-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="space-y-1">
                <div className="h-3.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
                <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            </div>
            <div className="h-6 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
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

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        <div className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {/* Stat Boxes */}
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

      {/* Cards de Parcerias */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28" />
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 h-28" />
      </div>
    </div>
  );
}

export function SkeletonPerfil() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando perfil..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5 animate-pulse"
    >
      <span className="sr-only">Carregando dados do atleta...</span>

      {/* Header do perfil com avatar */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
        <div className="size-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-36 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>

      {/* Stat Boxes */}
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

      {/* Seção de notificações e ações */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 h-32" />
    </div>
  );
}

export function SkeletonDetalhe() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando partida..."
      className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse"
    >
      <span className="sr-only">Carregando detalhes da partida...</span>

      {/* Header */}
      <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />

      {/* Placar estilo estádio */}
      <div className="h-36 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 flex flex-col justify-between" />

      {/* Times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3" />
        <div className="h-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3" />
      </div>
    </div>
  );
}

export function SkeletonGestao() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando gestão de jogadores..."
      className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse"
    >
      <span className="sr-only">Carregando gestão de jogadores...</span>
      <div className="h-6 w-44 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3"
          />
        ))}
      </div>
      <div className="h-10 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 h-14" />
        ))}
      </div>
    </div>
  );
}

/**
 * Fallback genérico para o Suspense de rotas do App.
 */
export function CarregandoGeral() {
  return (
    <div className="px-3 py-6 max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-6 w-36 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
      <div className="h-32 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4" />
      <div className="space-y-2">
        <div className="h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        <div className="h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        <div className="h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
      </div>
    </div>
  );
}
