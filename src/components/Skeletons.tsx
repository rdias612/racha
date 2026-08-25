/**
 * Skeletons estruturais com Cumulative Layout Shift (CLS) = 0.
 * Espelham fielmente a geometria Súmula de Quinta (cantos retos 4px, bordas duras, placares LED).
 */

export function SkeletonResumo() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando resumo..."
      className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl animate-pulse space-y-4 text-giz"
    >
      <span className="sr-only">Carregando boletim oficial do racha...</span>

      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-3 sumula-header pb-2">
        <div className="space-y-1.5">
          <div className="h-3 w-28 bg-superficie-2 border border-borda rounded-[2px]" />
          <div className="h-6 w-44 bg-superficie-2 border border-borda rounded-[3px]" />
        </div>
        <div className="h-4 w-20 bg-superficie-2 border border-borda rounded-[2px]" />
      </div>

      {/* Card Próxima Partida */}
      <div className="h-24 rounded-[4px] border-2 border-borda bg-superficie p-4 flex flex-col justify-between shadow-carimbo" />

      {/* Grid de Destaques (6 cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-[4px] border border-borda bg-superficie p-3 flex flex-col justify-between shadow-carimbo"
          >
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-superficie-2 border border-borda rounded-[2px]" />
              <div className="h-4 w-24 bg-superficie-2 border border-borda rounded-[2px]" />
            </div>
            <div className="pt-2 border-t border-borda">
              <div className="h-4 w-14 bg-superficie-2 border border-borda rounded-[2px]" />
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
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando mural de placares...</span>

      {/* Header */}
      <div className="flex items-center justify-between sumula-header pb-2">
        <div className="space-y-1">
          <div className="h-6 w-32 bg-superficie-2 border border-borda rounded-[3px]" />
          <div className="h-3 w-24 bg-superficie-2 border border-borda rounded-[2px]" />
        </div>
        <div className="h-7 w-28 bg-superficie-2 border border-borda rounded-[3px]" />
      </div>

      {/* Lista de Jogos (Mini-placares LED) */}
      <div className="space-y-3 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[4px] border-2 border-borda bg-superficie shadow-carimbo overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-superficie-2 border-b border-borda">
              <div className="h-3.5 w-28 bg-borda rounded-[2px]" />
              <div className="h-4 w-16 bg-borda rounded-[2px]" />
            </div>
            <div className="h-16 bg-led-fundo flex items-center justify-center p-3">
              <div className="h-8 w-44 bg-superficie-2 border border-borda rounded-[2px]" />
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
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando classificação dos atletas...</span>

      {/* Header */}
      <div className="sumula-header pb-2 flex justify-between items-baseline">
        <div className="h-6 w-44 bg-superficie-2 border border-borda rounded-[3px]" />
        <div className="h-3 w-20 bg-superficie-2 border border-borda rounded-[2px]" />
      </div>

      {/* Abas de métricas */}
      <div className="flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 h-7 rounded-[3px] bg-superficie-2 border border-borda" />
        ))}
      </div>

      {/* Pódio Top 3 */}
      <div className="grid grid-cols-3 gap-2 items-end pt-2">
        <div className="h-32 rounded-[4px] border border-borda bg-superficie p-2.5 shadow-carimbo" />
        <div className="h-40 rounded-[4px] border-2 border-destaque/50 bg-superficie p-3 shadow-carimbo -translate-y-1" />
        <div className="h-28 rounded-[4px] border border-borda bg-superficie p-2.5 shadow-carimbo" />
      </div>

      {/* Tabela de Classificação */}
      <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo divide-y divide-borda overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-4 bg-superficie-2 rounded-[2px]" />
              <div className="size-6 bg-superficie-2 rounded-[3px]" />
              <div className="h-3.5 w-24 bg-superficie-2 rounded-[2px]" />
            </div>
            <div className="h-4 w-12 bg-superficie-2 rounded-[2px]" />
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
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando estatísticas e parcerias...</span>

      {/* Header */}
      <div className="sumula-header pb-2 flex justify-between items-baseline">
        <div className="h-6 w-44 bg-superficie-2 border border-borda rounded-[3px]" />
        <div className="h-3 w-20 bg-superficie-2 border border-borda rounded-[2px]" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-[4px] border border-borda bg-superficie p-1">
        <div className="flex-1 h-7 rounded-[3px] bg-superficie-2 border border-borda" />
        <div className="flex-1 h-7 rounded-[3px] bg-superficie-2 border border-borda" />
      </div>

      {/* Stat Boxes */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[4px] border border-borda bg-superficie p-2.5 flex flex-col items-center justify-center gap-1.5 h-16 shadow-carimbo"
          >
            <div className="h-5 w-8 bg-superficie-2 rounded-[2px]" />
            <div className="h-2.5 w-12 bg-superficie-2 rounded-[2px]" />
          </div>
        ))}
      </div>

      {/* Cards de Parcerias */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[4px] border border-borda bg-superficie p-3 h-28 shadow-carimbo" />
        <div className="rounded-[4px] border border-borda bg-superficie p-3 h-28 shadow-carimbo" />
      </div>
    </div>
  );
}

export function SkeletonComparador() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando confronto..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando confronto direto...</span>

      {/* Header */}
      <div className="sumula-header pb-2 flex justify-between items-baseline">
        <div className="h-6 w-40 bg-superficie-2 border border-borda rounded-[3px]" />
        <div className="h-3 w-24 bg-superficie-2 border border-borda rounded-[2px]" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-[4px] border border-borda bg-superficie p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 h-7 rounded-[3px] bg-superficie-2 border border-borda" />
        ))}
      </div>

      {/* Card do Duelo (avatar A + swap + avatar B) */}
      <div className="h-24 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo flex items-center justify-between">
        <div className="size-12 rounded-[3px] bg-superficie-2 border border-borda" />
        <div className="size-11 rounded-[4px] bg-superficie-2 border border-borda" />
        <div className="size-12 rounded-[3px] bg-superficie-2 border border-borda" />
      </div>

      {/* Seletores A/B */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
        <div className="h-[64px] rounded-[4px] bg-superficie-2 border border-borda" />
        <div className="h-[64px] rounded-[4px] bg-superficie-2 border border-borda" />
      </div>

      {/* Métricas (lista contínua de 7 linhas valor | rótulo | valor + barra) */}
      <div className="space-y-2">
        <div className="h-3 w-36 bg-superficie-2 border border-borda rounded-[2px]" />
        <div className="divide-y divide-borda/40 border-y border-borda">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2.5 px-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="w-12 h-5 bg-superficie-2 rounded-[2px]" />
                <div className="flex-1 max-w-24 mx-auto h-2.5 bg-superficie-2 rounded-[2px]" />
                <div className="w-12 h-5 bg-superficie-2 rounded-[2px]" />
              </div>
              <div className="h-1.5 rounded-[2px] bg-superficie-2 border border-borda" />
            </div>
          ))}
        </div>
      </div>

      {/* Bloco Juntos */}
      <div className="space-y-2">
        <div className="h-3 w-48 bg-superficie-2 border border-borda rounded-[2px]" />
        <div className="h-36 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo" />
      </div>

      {/* Bloco Adversos */}
      <div className="space-y-2">
        <div className="h-3 w-40 bg-superficie-2 border border-borda rounded-[2px]" />
        <div className="h-40 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo" />
      </div>

      {/* Histórico (4 linhas) */}
      <div className="space-y-2">
        <div className="h-3 w-32 bg-superficie-2 border border-borda rounded-[2px]" />
        <div className="divide-y divide-borda/40 border-y border-borda">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-[44px] px-1 flex items-center justify-between">
              <div className="h-3.5 w-24 bg-superficie-2 rounded-[2px]" />
              <div className="h-4 w-14 bg-superficie-2 rounded-[2px]" />
              <div className="h-4 w-14 bg-superficie-2 rounded-[2px]" />
            </div>
          ))}
        </div>
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
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando perfil do jogador...</span>

      {/* Header com avatar */}
      <div className="flex items-center gap-4 p-4 rounded-[4px] border border-borda bg-superficie shadow-carimbo">
        <div className="size-14 rounded-[4px] bg-superficie-2 border border-borda" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-36 bg-superficie-2 rounded-[2px]" />
          <div className="h-3 w-24 bg-superficie-2 rounded-[2px]" />
        </div>
      </div>

      {/* Stat Boxes */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[4px] border border-borda bg-superficie p-2.5 flex flex-col items-center justify-center gap-1.5 h-16 shadow-carimbo"
          >
            <div className="h-5 w-8 bg-superficie-2 rounded-[2px]" />
            <div className="h-2.5 w-12 bg-superficie-2 rounded-[2px]" />
          </div>
        ))}
      </div>

      {/* Seção */}
      <div className="rounded-[4px] border border-borda bg-superficie p-4 h-32 shadow-carimbo" />
    </div>
  );
}

export function SkeletonDetalhe() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando partida..."
      className="px-3 py-4 pb-24 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando detalhes da súmula...</span>

      {/* Header */}
      <div className="h-4 w-20 bg-superficie-2 rounded-[2px]" />

      {/* Placar LED */}
      <div className="h-24 rounded-[4px] border-2 border-borda bg-led-fundo shadow-carimbo-preto p-3 flex items-center justify-center" />

      {/* Times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-56 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo" />
        <div className="h-56 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo" />
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
      className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando gestão de jogadores...</span>
      <div className="h-6 w-44 bg-superficie-2 border border-borda rounded-[3px]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo"
          />
        ))}
      </div>
      <div className="h-10 w-full rounded-[4px] bg-superficie-2 border border-borda" />
      <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo divide-y divide-borda overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 h-14" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonNotificacoes() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando configurações de notificações..."
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse text-giz"
    >
      <span className="sr-only">Carregando painel de notificações push...</span>

      {/* Voltar */}
      <div className="h-3 w-16 bg-superficie-2 border border-borda rounded-[2px]" />

      {/* Header */}
      <div className="flex items-center justify-between sumula-header pb-2">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-[2px] bg-superficie-2 border border-borda" />
          <div className="h-6 w-48 bg-superficie-2 border border-borda rounded-[3px]" />
        </div>
        <div className="h-3 w-20 bg-superficie-2 border border-borda rounded-[2px]" />
      </div>

      {/* Card 1: Confirmação de Presença */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 space-y-3 shadow-carimbo">
        <div className="flex items-center justify-between">
          <div className="h-4 w-44 bg-superficie-2 border border-borda rounded-[2px]" />
          <div className="h-6 w-12 bg-superficie-2 border border-borda rounded-[3px]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 bg-superficie-2 border border-borda rounded-[4px]" />
          <div className="h-10 bg-superficie-2 border border-borda rounded-[4px]" />
        </div>
        <div className="h-16 bg-superficie-2 border border-borda rounded-[4px]" />
      </div>

      {/* Card 2: Lembretes de Votação */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 space-y-3 shadow-carimbo">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-superficie-2 border border-borda rounded-[2px]" />
          <div className="h-6 w-12 bg-superficie-2 border border-borda rounded-[3px]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-superficie-2 border border-borda rounded-[4px]" />
          ))}
        </div>
      </div>

      {/* Card 3: Ações e Testes */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 space-y-3 shadow-carimbo">
        <div className="h-4 w-32 bg-superficie-2 border border-borda rounded-[2px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-20 bg-superficie-2 border border-borda rounded-[4px]" />
          <div className="h-20 bg-superficie-2 border border-borda rounded-[4px]" />
        </div>
      </div>

      {/* Botão Salvar */}
      <div className="h-11 w-full bg-superficie-2 border border-borda rounded-[4px]" />
    </div>
  );
}

/**
 * Fallback genérico para o Suspense de rotas do App.
 */
export function CarregandoGeral() {
  return (
    <div className="px-3 py-6 max-w-2xl mx-auto space-y-4 animate-pulse text-giz">
      <div className="h-6 w-36 bg-superficie-2 border border-borda rounded-[3px]" />
      <div className="h-32 rounded-[4px] border border-borda bg-superficie p-4 shadow-carimbo" />
      <div className="space-y-2">
        <div className="h-12 rounded-[4px] bg-superficie border border-borda" />
        <div className="h-12 rounded-[4px] bg-superficie border border-borda" />
        <div className="h-12 rounded-[4px] bg-superficie border border-borda" />
      </div>
    </div>
  );
}
