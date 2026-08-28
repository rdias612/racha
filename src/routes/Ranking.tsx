import { useCallback, useEffect, useState, useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { POSICOES, type PosicaoId } from '../lib/times';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useCache } from '../hooks/useCache';
import { chaveRanking } from '../lib/chavesCache';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { MensagemEstado } from '../components/Estado';
import { SkeletonRanking } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { Avatar } from '../components/Avatar';

type Metrica = 'pontos' | 'gols' | 'assistencias' | 'gols-contra';
type CampoMetrica = 'pontos' | 'gols' | 'assistencias' | 'gols_contra';
type ColunaOrdenacao =
  | 'username'
  | CampoMetrica
  | 'media_gols'
  | 'percentual_vitorias'
  | 'partidas'
  | 'vitorias'
  | 'empates'
  | 'derrotas';

type DirecaoOrdenacao = 'asc' | 'desc';

const numero2casas = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const metricas: Record<
  Metrica,
  { titulo: string; coluna: string; campo: CampoMetrica; unidade: string }
> = {
  pontos: { titulo: 'Classificação Geral', coluna: 'PTS', campo: 'pontos', unidade: 'pts' },
  gols: { titulo: 'Artilharia da Temporada', coluna: 'GOLS', campo: 'gols', unidade: 'gols' },
  assistencias: {
    titulo: 'Líderes de Assistências',
    coluna: 'ASSISTS',
    campo: 'assistencias',
    unidade: 'assists',
  },
  'gols-contra': {
    titulo: 'Ranking de Gols Contra (Zoeira)',
    coluna: 'GC',
    campo: 'gols_contra',
    unidade: 'GC',
  },
};

interface ColunaTabela {
  key: ColunaOrdenacao;
  label: string;
}

interface LinhaRanking {
  jogador_id: number;
  username: string;
  posicao: PosicaoId;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
}

export function Ranking() {
  const jogadorLogado = useJogadorLogado();
  const { metrica: parametro } = useParams<{ metrica: Metrica }>();
  const metrica: Metrica = parametro && parametro in metricas ? parametro : 'pontos';
  const configuracao = metricas[metrica];
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>(configuracao.campo);
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>('desc');
  const [posicaoFiltro, setPosicaoFiltro] = useState<PosicaoId | 'todas'>('todas');
  const [minimoPartidas, setMinimoPartidas] = useState(6);

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ['/ranking/pontos', '/ranking/gols', '/ranking/assistencias', '/ranking/gols-contra'],
    activeTab: `/ranking/${metrica}`,
  });

  // Reset de filtros e ordenação ao trocar a métrica (o campo muda junto com a rota /ranking/:metrica)
  useEffect(() => {
    setPosicaoFiltro('todas');
    setColunaOrdenacao(configuracao.campo);
    setDirecaoOrdenacao('desc');
  }, [configuracao.campo]);

  // Cache por filtro de posição: trocar de filtro serve o cache na hora (ou
  // mantém a lista atual enquanto busca) sem nunca piscar skeleton.
  const buscar = useCallback(async (): Promise<LinhaRanking[]> => {
    let query = supabase
      .from('ranking')
      .select(
        'jogador_id, username, posicao, pontos, vitorias, empates, derrotas, partidas, gols, assistencias, gols_contra'
      )
      .order('pontos', { ascending: false })
      .order('vitorias', { ascending: false })
      .order('partidas', { ascending: false })
      .order('gols', { ascending: false })
      .order('assistencias', { ascending: false })
      .order('username', { ascending: true });

    if (posicaoFiltro !== 'todas') {
      query = query.eq('posicao', posicaoFiltro);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? [])
      .filter((r) => r.jogador_id != null && r.username != null)
      .map((r) => ({
        jogador_id: r.jogador_id!,
        username: r.username!,
        posicao: (r.posicao as PosicaoId) ?? 'random',
        pontos: r.pontos ?? 0,
        vitorias: r.vitorias ?? 0,
        empates: r.empates ?? 0,
        derrotas: r.derrotas ?? 0,
        partidas: r.partidas ?? 0,
        gols: r.gols ?? 0,
        assistencias: r.assistencias ?? 0,
        gols_contra: r.gols_contra ?? 0,
      }));
  }, [posicaoFiltro]);

  const { dados, carregando, erro, recarregar } = useCache<LinhaRanking[]>(
    chaveRanking(posicaoFiltro),
    buscar
  );

  const linhas = useMemo(() => dados ?? [], [dados]);

  function valorOrdenacao(linha: LinhaRanking, coluna: ColunaOrdenacao) {
    if (coluna === 'username') return linha.username;
    if (coluna === 'media_gols') {
      return linha.partidas > 0 ? linha.gols / linha.partidas : 0;
    }
    if (coluna === 'percentual_vitorias') {
      return linha.partidas > 0 ? linha.vitorias / linha.partidas : 0;
    }
    return linha[coluna as keyof LinhaRanking];
  }

  function selecionarOrdenacao(coluna: ColunaOrdenacao) {
    if (coluna === colunaOrdenacao) {
      setDirecaoOrdenacao((direcao) => (direcao === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao(coluna === 'username' ? 'asc' : 'desc');
  }

  const maximoPartidas = useMemo(
    () => Math.max(6, ...linhas.map((linha) => linha.partidas)),
    [linhas]
  );

  const colunasOrdenacao = useMemo<ColunaTabela[]>(
    () => [
      { key: 'username', label: 'Atleta' },
      { key: configuracao.campo, label: configuracao.coluna },
      ...(metrica === 'gols' ? [{ key: 'media_gols' as const, label: 'Média' }] : []),
      { key: 'percentual_vitorias', label: '%V' },
      { key: 'partidas', label: 'J' },
      { key: 'vitorias', label: 'V' },
      { key: 'empates', label: 'E' },
      { key: 'derrotas', label: 'D' },
    ],
    [configuracao.campo, configuracao.coluna, metrica]
  );

  const linhasOrdenadas = useMemo(() => {
    return [...linhas].sort((a, b) => {
      const valorA = valorOrdenacao(a, colunaOrdenacao);
      const valorB = valorOrdenacao(b, colunaOrdenacao);
      const fator = direcaoOrdenacao === 'asc' ? 1 : -1;

      if (typeof valorA === 'string' && typeof valorB === 'string') {
        return valorA.localeCompare(valorB) * fator;
      }
      return (Number(valorA) - Number(valorB)) * fator;
    });
  }, [linhas, colunaOrdenacao, direcaoOrdenacao]);

  const linhasFiltradas = useMemo(() => {
    return linhasOrdenadas.filter((linha) => linha.partidas >= minimoPartidas);
  }, [linhasOrdenadas, minimoPartidas]);

  if (carregando) return <SkeletonRanking />;
  // Erro apenas na primeira visita (sem cache): com dados em tela, a falha de
  // revalidação em background é tolerada silenciosamente.
  if (erro && !dados)
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;

  return (
    <PullToRefresh onRefresh={recarregar}>
      <div
        className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto touch-pan-y text-giz"
        {...swipeHandlers}
      >
        {/* Cabeçalho de Súmula */}
        <div className="sumula-header pb-2 mb-3 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            {configuracao.titulo}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Oficial CBO
          </span>
        </div>

        {/* Abas de métricas */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-xs no-scrollbar">
          <NavLink
            to="/ranking/pontos"
            className={({ isActive }) =>
              `flex-1 min-w-max min-h-[44px] flex items-center justify-center rounded-[3px] px-3 py-1.5 text-center font-display uppercase tracking-wider text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Pontuação
          </NavLink>
          <NavLink
            to="/ranking/gols"
            className={({ isActive }) =>
              `flex-1 min-w-max min-h-[44px] flex items-center justify-center rounded-[3px] px-3 py-1.5 text-center font-display uppercase tracking-wider text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Gols
          </NavLink>
          <NavLink
            to="/ranking/assistencias"
            className={({ isActive }) =>
              `flex-1 min-w-max min-h-[44px] flex items-center justify-center rounded-[3px] px-3 py-1.5 text-center font-display uppercase tracking-wider text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Assistências
          </NavLink>
          <NavLink
            to="/ranking/gols-contra"
            className={({ isActive }) =>
              `flex-1 min-w-max min-h-[44px] flex items-center justify-center rounded-[3px] px-3 py-1.5 text-center font-display uppercase tracking-wider text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Gols Contra
          </NavLink>
        </div>

        {/* Filtros */}
        <div className="mb-4 space-y-3 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div>
            <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1.5">
              Posição
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPosicaoFiltro('todas')}
                className={`min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                  posicaoFiltro === 'todas'
                    ? 'bg-destaque text-destaque-tinta shadow-xs'
                    : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz'
                }`}
              >
                Todas
              </button>
              {(Object.keys(POSICOES) as PosicaoId[]).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPosicaoFiltro(pos)}
                  className={`min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                    posicaoFiltro === pos
                      ? 'bg-destaque text-destaque-tinta shadow-xs'
                      : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz'
                  }`}
                >
                  {POSICOES[pos]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              <span>Mínimo de partidas</span>
              <span className="font-mono text-destaque-texto">{minimoPartidas} jogos</span>
            </div>
            <input
              type="range"
              min={0}
              max={maximoPartidas}
              value={minimoPartidas}
              onChange={(e) =>
                setMinimoPartidas(
                  Number(e.target.value) <= maximoPartidas ? Number(e.target.value) : maximoPartidas
                )
              }
              className="w-full accent-destaque"
            />
          </div>
        </div>

        {linhasFiltradas.length === 0 ? (
          <MensagemEstado tipo="info">
            O ranking nasce no primeiro apito. Nada publicado com esses filtros ainda.
          </MensagemEstado>
        ) : (
          <>
            {/* Pódio Top 3 */}
            {linhasFiltradas.length >= 3 && (
              <PodioTop3
                linhas={linhasFiltradas.slice(0, 3)}
                campoMetrica={configuracao.campo}
                unidade={configuracao.unidade}
              />
            )}

            {/* Tabela com data-no-swipe para não travar scroll horizontal */}
            <TabelaRanking
              linhas={linhasFiltradas}
              colunasOrdenacao={colunasOrdenacao}
              colunaOrdenacao={colunaOrdenacao}
              direcaoOrdenacao={direcaoOrdenacao}
              selecionarOrdenacao={selecionarOrdenacao}
              valorOrdenacao={valorOrdenacao}
              jogadorLogadoId={jogadorLogado?.id}
            />
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

function PodioTop3({
  linhas,
  campoMetrica,
  unidade,
}: {
  linhas: LinhaRanking[];
  campoMetrica: CampoMetrica;
  unidade: string;
}) {
  const primeiro = linhas[0];
  const segundo = linhas[1];
  const terceiro = linhas[2];

  if (!primeiro || !segundo || !terceiro) return null;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-2 items-end pt-2">
        {/* 2º Lugar (Esquerda) */}
        <div className="rounded-[4px] border border-borda bg-superficie p-2.5 text-center shadow-carimbo flex flex-col items-center justify-between min-h-[140px]">
          <span className="texto-vazado font-display font-black text-3xl leading-none">2</span>
          <Avatar username={segundo.username} posicao={segundo.posicao} size="sm" />
          <div className="w-full truncate mt-1">
            <span className="block truncate text-xs font-bold text-giz">@{segundo.username}</span>
            <span className="block font-mono text-xs font-bold text-giz-fraco tabular-nums">
              {segundo[campoMetrica]} {unidade}
            </span>
          </div>
        </div>

        {/* 1º Lugar (Centro - Maior e em Destaque Âmbar) */}
        <div className="rounded-[4px] border-2 border-destaque bg-destaque text-destaque-tinta p-3 text-center shadow-carimbo-destaque flex flex-col items-center justify-between min-h-[165px] -translate-y-1">
          <div className="flex items-center justify-center gap-1">
            <span className="font-display font-black text-4xl leading-none text-destaque-tinta">
              1
            </span>
            <span className="text-xs">👑</span>
          </div>
          <Avatar username={primeiro.username} posicao={primeiro.posicao} size="md" />
          <div className="w-full truncate mt-1">
            <span className="block truncate text-xs font-black uppercase tracking-wider">
              @{primeiro.username}
            </span>
            <span className="block font-mono text-sm font-black tabular-nums">
              {primeiro[campoMetrica]} {unidade}
            </span>
          </div>
        </div>

        {/* 3º Lugar (Direita) */}
        <div className="rounded-[4px] border border-borda bg-superficie p-2.5 text-center shadow-carimbo flex flex-col items-center justify-between min-h-[130px]">
          <span className="texto-vazado font-display font-black text-2xl leading-none">3</span>
          <Avatar username={terceiro.username} posicao={terceiro.posicao} size="sm" />
          <div className="w-full truncate mt-1">
            <span className="block truncate text-xs font-bold text-giz">@{terceiro.username}</span>
            <span className="block font-mono text-xs font-bold text-giz-fraco tabular-nums">
              {terceiro[campoMetrica]} {unidade}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 my-3 text-[10px] font-mono uppercase tracking-widest text-giz-fraco justify-center">
        <span className="h-px bg-borda flex-1" />
        <span>— classificação geral —</span>
        <span className="h-px bg-borda flex-1" />
      </div>
    </div>
  );
}

function TabelaRanking({
  linhas,
  colunasOrdenacao,
  colunaOrdenacao,
  direcaoOrdenacao,
  selecionarOrdenacao,
  valorOrdenacao,
  jogadorLogadoId,
}: {
  linhas: LinhaRanking[];
  colunasOrdenacao: ColunaTabela[];
  colunaOrdenacao: ColunaOrdenacao;
  direcaoOrdenacao: DirecaoOrdenacao;
  selecionarOrdenacao: (coluna: ColunaOrdenacao) => void;
  valorOrdenacao: (linha: LinhaRanking, coluna: ColunaOrdenacao) => number | string;
  jogadorLogadoId?: number;
}) {
  return (
    <div
      data-no-swipe
      className="overflow-x-auto rounded-[4px] border border-borda bg-superficie shadow-carimbo"
    >
      <table className="w-full min-w-120 text-sm">
        <thead className="bg-superficie-2 border-b border-borda text-giz-fraco">
          <tr>
            <th className="px-2 py-2 text-left font-display font-bold uppercase tracking-wider text-xs w-8">
              #
            </th>
            {colunasOrdenacao.map((coluna) => {
              const ativa = colunaOrdenacao === coluna.key;
              const direcao = ativa ? direcaoOrdenacao : null;
              const ehAtleta = coluna.key === 'username';
              return (
                <th
                  key={coluna.key}
                  aria-sort={
                    direcao === 'asc' ? 'ascending' : direcao === 'desc' ? 'descending' : 'none'
                  }
                  className={`p-0 font-display font-bold uppercase tracking-wider text-xs ${
                    ehAtleta ? 'w-px whitespace-nowrap text-left sm:min-w-44' : 'text-right'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selecionarOrdenacao(coluna.key)}
                    className={`w-full min-h-[44px] px-2 py-2 inline-flex items-center gap-1 cursor-pointer select-none transition ${
                      ehAtleta ? 'justify-start' : 'justify-end'
                    } ${ativa ? 'text-destaque-texto font-black' : 'hover:text-giz'}`}
                  >
                    <span>{coluna.label}</span>
                    <span aria-hidden="true" className="font-mono text-[10px]">
                      {direcao === 'asc' ? '▲' : direcao === 'desc' ? '▼' : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {linhas.map((l, i) => {
            const primeiro = i === 0;
            const ehLogado = l.jogador_id === jogadorLogadoId;
            return (
              <tr
                key={l.jogador_id}
                className={`transition hover:bg-superficie-2 ${
                  ehLogado ? 'border-l-2 border-destaque bg-destaque/10' : 'bg-superficie'
                }`}
              >
                <td className="px-2 py-2 font-mono text-xs font-bold text-giz-fraco">
                  {primeiro ? '🏆' : i + 1}
                </td>
                {colunasOrdenacao.map((coluna) => (
                  <td
                    key={coluna.key}
                    className={`px-2 py-2 ${
                      coluna.key === 'username'
                        ? 'whitespace-nowrap text-giz font-medium text-xs'
                        : 'text-right font-mono text-xs text-giz tabular-nums font-semibold'
                    }`}
                  >
                    {coluna.key === 'username' ? (
                      <div className="flex items-center gap-2">
                        <Avatar username={l.username} posicao={l.posicao} size="xs" />
                        <span className="font-bold">@{l.username}</span>
                      </div>
                    ) : coluna.key === 'media_gols' ? (
                      numero2casas.format(Number(valorOrdenacao(l, coluna.key)))
                    ) : coluna.key === 'percentual_vitorias' ? (
                      `${Math.round(Number(valorOrdenacao(l, coluna.key)) * 100)}%`
                    ) : (
                      l[coluna.key as keyof LinhaRanking]
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
