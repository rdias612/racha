import { useCallback, useEffect, useState, useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { POSICOES, type PosicaoId } from '../lib/times';
import { vibrateLight } from '../lib/haptics';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useCache } from '../hooks/useCache';
import { chaveRanking } from '../lib/chavesCache';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { MensagemEstado } from '../components/Estado';
import { SkeletonRanking } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { ModalFiltrosRanking, type PosicaoFiltro } from '../components/ModalFiltrosRanking';

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

const metricas: Record<Metrica, { titulo: string; coluna: string; campo: CampoMetrica }> = {
  pontos: { titulo: 'Classificação Geral', coluna: 'PTS', campo: 'pontos' },
  gols: { titulo: 'Artilharia da Temporada', coluna: 'GOLS', campo: 'gols' },
  assistencias: { titulo: 'Líderes de Assistências', coluna: 'ASSISTS', campo: 'assistencias' },
  'gols-contra': { titulo: 'Ranking de Gols Contra (Zoeira)', coluna: 'GC', campo: 'gols_contra' },
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
  const [posicaoFiltro, setPosicaoFiltro] = useState<PosicaoFiltro>('todas');
  const [minimoPartidas, setMinimoPartidas] = useState(6);
  const [modalFiltrosAberto, setModalFiltrosAberto] = useState(false);

  function handleAplicarFiltros(novaPosicao: PosicaoFiltro, novoMinimo: number) {
    setPosicaoFiltro(novaPosicao);
    setMinimoPartidas(novoMinimo);
  }

  function handleLimparFiltros() {
    vibrateLight();
    setPosicaoFiltro('todas');
    setMinimoPartidas(6);
  }

  function handleRemoverFiltroPosicao() {
    vibrateLight();
    setPosicaoFiltro('todas');
  }

  function handleRemoverFiltroMinimo() {
    vibrateLight();
    setMinimoPartidas(6);
  }

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

  const posicaoAtiva = posicaoFiltro !== 'todas';
  const partidasAtivas = minimoPartidas !== 6;
  const totalFiltrosAtivos = (posicaoAtiva ? 1 : 0) + (partidasAtivas ? 1 : 0);

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

        {/* Barra de Ferramentas / Filtros */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-display uppercase tracking-wider text-giz-fraco">
              {linhasFiltradas.length === linhas.length ? (
                <>
                  <span className="font-mono font-bold text-giz">{linhas.length}</span> atletas no
                  boletim
                </>
              ) : (
                <>
                  Exibindo{' '}
                  <span className="font-mono font-bold text-giz">{linhasFiltradas.length}</span> de{' '}
                  <span className="font-mono text-giz">{linhas.length}</span> atletas
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => {
                vibrateLight();
                setModalFiltrosAberto(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={modalFiltrosAberto}
              className={`min-h-[40px] px-3 py-1.5 rounded-[4px] border inline-flex items-center gap-1.5 font-display uppercase tracking-wider text-xs font-bold transition cursor-pointer select-none active:translate-y-px ${
                totalFiltrosAtivos > 0
                  ? 'border-destaque bg-destaque/10 text-destaque-texto shadow-xs font-black'
                  : 'border-borda bg-superficie text-giz-fraco hover:text-giz hover:bg-superficie-2 shadow-xs'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {totalFiltrosAtivos > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-[2px] bg-destaque text-destaque-tinta font-black">
                  {totalFiltrosAtivos}
                </span>
              )}
            </button>
          </div>

          {/* Chips de filtros ativos */}
          {totalFiltrosAtivos > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {posicaoAtiva && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[3px] border border-destaque/40 bg-destaque/10 text-destaque-texto text-xs font-display font-bold uppercase tracking-wider">
                  <span>Posição: {POSICOES[posicaoFiltro]}</span>
                  <button
                    type="button"
                    onClick={handleRemoverFiltroPosicao}
                    aria-label="Remover filtro de posição"
                    className="hover:text-giz cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {partidasAtivas && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[3px] border border-destaque/40 bg-destaque/10 text-destaque-texto text-xs font-display font-bold uppercase tracking-wider">
                  <span>Mín. {minimoPartidas} jogos</span>
                  <button
                    type="button"
                    onClick={handleRemoverFiltroMinimo}
                    aria-label="Remover filtro de mínimo de partidas"
                    className="hover:text-giz cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="text-[11px] font-display uppercase tracking-wider text-giz-fraco hover:text-giz underline cursor-pointer ml-1"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        {linhasFiltradas.length === 0 ? (
          <div className="space-y-3">
            <MensagemEstado tipo="info">
              {totalFiltrosAtivos > 0
                ? 'Nenhum atleta encontrado com os filtros atuais.'
                : 'O ranking nasce no primeiro apito. Nada publicado com esses filtros ainda.'}
            </MensagemEstado>
            {totalFiltrosAtivos > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] border border-borda bg-superficie px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition shadow-carimbo cursor-pointer"
                >
                  Redefinir filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <TabelaRanking
            linhas={linhasFiltradas}
            colunasOrdenacao={colunasOrdenacao}
            colunaOrdenacao={colunaOrdenacao}
            direcaoOrdenacao={direcaoOrdenacao}
            selecionarOrdenacao={selecionarOrdenacao}
            valorOrdenacao={valorOrdenacao}
            jogadorLogadoId={jogadorLogado?.id}
          />
        )}

        <ModalFiltrosRanking
          open={modalFiltrosAberto}
          onClose={() => setModalFiltrosAberto(false)}
          posicao={posicaoFiltro}
          minimoPartidas={minimoPartidas}
          maximoPartidas={maximoPartidas}
          onAplicar={handleAplicarFiltros}
          onLimpar={handleLimparFiltros}
        />
      </div>
    </PullToRefresh>
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
      <table className="w-full min-w-full text-sm">
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
                    ehAtleta ? 'w-px whitespace-nowrap text-left' : 'text-right'
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
                        ? 'w-px whitespace-nowrap text-giz font-medium text-xs'
                        : 'text-right font-mono text-xs text-giz tabular-nums font-semibold'
                    }`}
                  >
                    {coluna.key === 'username' ? (
                      <span className="font-bold text-giz">{l.username}</span>
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
