import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { MensagemEstado } from '../components/Estado';
import { SkeletonEstatisticas } from '../components/Skeletons';
import { DuplaCard } from '../components/DuplaCard';
import { SecaoRacha } from '../components/SecaoRacha';
import { Avatar } from '../components/Avatar';
import { PullToRefresh } from '../components/PullToRefresh';
import { carregarParesRacha, type ParRacha } from '../lib/partidas';
import { useSwipeTabs } from '../hooks/useSwipeTabs';

const MIN_PARTIDAS = 5;

export type ColunaOrdenacaoDuplas = 'pontos' | 'partidas' | 'percentual' | 'vitorias' | 'dupla';

export type DirecaoOrdenacao = 'asc' | 'desc';

function compararPares(
  a: ParRacha,
  b: ParRacha,
  coluna: ColunaOrdenacaoDuplas,
  direcao: DirecaoOrdenacao
): number {
  const fator = direcao === 'asc' ? 1 : -1;
  const nomeA = `${a.jogador_a_nome} ${a.jogador_b_nome}`.toLowerCase();
  const nomeB = `${b.jogador_a_nome} ${b.jogador_b_nome}`.toLowerCase();

  if (coluna === 'dupla') {
    const cmp = nomeA.localeCompare(nomeB);
    return (cmp !== 0 ? cmp : b.pontos - a.pontos) * fator;
  }

  if (coluna === 'pontos') {
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === 'partidas') {
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === 'percentual') {
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === 'vitorias') {
    if (a.vitorias !== b.vitorias) return (a.vitorias - b.vitorias) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    return nomeA.localeCompare(nomeB);
  }

  return 0;
}

export function EstatisticasRacha() {
  const [pares, setPares] = useState<ParRacha[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacaoDuplas>('pontos');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>('desc');

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ['/estatisticas/jogador', '/estatisticas/racha', '/estatisticas/comparar'],
    activeTab: '/estatisticas/racha',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await carregarParesRacha(MIN_PARTIDAS);
      setPares(dados);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function selecionarOrdenacao(coluna: ColunaOrdenacaoDuplas) {
    if (coluna === colunaOrdenacao) {
      setDirecaoOrdenacao((direcao) => (direcao === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao(coluna === 'dupla' ? 'asc' : 'desc');
  }

  if (erro) {
    return <MensagemEstado tipo="erro">Falha ao carregar: {erro}</MensagemEstado>;
  }
  if (carregando && pares === null) {
    return <SkeletonEstatisticas />;
  }

  const paresOrdenados = pares
    ? [...pares].sort((a, b) => compararPares(a, b, colunaOrdenacao, direcaoOrdenacao))
    : [];

  const paresMelhorPior = pares
    ? [...pares].sort((a, b) =>
        compararPares(a, b, colunaOrdenacao === 'dupla' ? 'pontos' : colunaOrdenacao, 'desc')
      )
    : [];

  const melhor = paresMelhorPior[0] ?? null;
  const pior =
    paresMelhorPior.length > 1 ? (paresMelhorPior[paresMelhorPior.length - 1] ?? null) : null;

  return (
    <PullToRefresh onRefresh={carregar}>
      <div
        className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 pb-20 sm:px-4 touch-pan-y text-giz"
        {...swipeHandlers}
      >
        {/* Cabeçalho da Súmula */}
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Estatísticas do Racha
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Oficial CBO
          </span>
        </div>

        {/* Abas */}
        <div className="flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-xs">
          <NavLink
            to="/estatisticas/jogador"
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Jogador
          </NavLink>
          <NavLink
            to="/estatisticas/racha"
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Racha
          </NavLink>
          <NavLink
            to="/estatisticas/comparar"
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition ${
                isActive
                  ? 'bg-destaque text-destaque-tinta shadow-xs'
                  : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
              }`
            }
          >
            Comparar
          </NavLink>
        </div>

        {/* Seção de Duplas */}
        <SecaoRacha
          titulo="Duplas & Parcerias"
          nota={`Consideramos apenas duplas com pelo menos ${MIN_PARTIDAS} partidas juntos.`}
        >
          {paresOrdenados.length === 0 ? (
            <MensagemEstado tipo="info">
              Ainda não há duplas com {MIN_PARTIDAS}+ partidas nesta temporada.
            </MensagemEstado>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <DuplaCard titulo="Melhor dupla" par={melhor} metrica={colunaOrdenacao} />
                <DuplaCard titulo="Pior dupla" par={pior} metrica={colunaOrdenacao} />
              </div>

              <div>
                <p className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-2">
                  Top 5 Parcerias
                </p>
                <TabelaDuplas
                  pares={paresOrdenados.slice(0, 5)}
                  colunaOrdenacao={colunaOrdenacao}
                  direcaoOrdenacao={direcaoOrdenacao}
                  onOrdenar={selecionarOrdenacao}
                  inicio={1}
                />
              </div>

              {paresOrdenados.length > 5 && (
                <div>
                  <p className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-2">
                    Bottom 5 Parcerias
                  </p>
                  <TabelaDuplas
                    pares={paresOrdenados.slice(-5).reverse()}
                    colunaOrdenacao={colunaOrdenacao}
                    direcaoOrdenacao={direcaoOrdenacao}
                    onOrdenar={selecionarOrdenacao}
                    inicio={1}
                  />
                </div>
              )}
            </div>
          )}
        </SecaoRacha>
      </div>
    </PullToRefresh>
  );
}

interface TabelaDuplasProps {
  pares: ParRacha[];
  colunaOrdenacao: ColunaOrdenacaoDuplas;
  direcaoOrdenacao: DirecaoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenacaoDuplas) => void;
  inicio?: number;
}

function TabelaDuplas({
  pares,
  colunaOrdenacao,
  direcaoOrdenacao,
  onOrdenar,
  inicio = 1,
}: TabelaDuplasProps) {
  function renderIndicador(coluna: ColunaOrdenacaoDuplas) {
    if (colunaOrdenacao !== coluna) {
      return (
        <ArrowUpDown className="size-3 text-giz-fraco opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
      );
    }
    return direcaoOrdenacao === 'asc' ? (
      <ArrowUp className="size-3 text-destaque shrink-0" />
    ) : (
      <ArrowDown className="size-3 text-destaque shrink-0" />
    );
  }

  function renderTh(
    coluna: ColunaOrdenacaoDuplas,
    label: string,
    align: 'left' | 'center' | 'right' = 'center'
  ) {
    const ativa = colunaOrdenacao === coluna;
    const justifyClass =
      align === 'left'
        ? 'justify-start'
        : align === 'right'
          ? 'justify-end ml-auto'
          : 'justify-center mx-auto';

    return (
      <th
        scope="col"
        aria-sort={ativa ? (direcaoOrdenacao === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2 ${
          align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
        }`}
      >
        <button
          type="button"
          onClick={() => onOrdenar(coluna)}
          className={`group inline-flex items-center gap-1 font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer select-none ${justifyClass} ${
            ativa ? 'text-destaque font-black' : 'text-giz-fraco hover:text-giz'
          }`}
          title={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          {renderIndicador(coluna)}
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[4px] border border-borda bg-superficie shadow-carimbo">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-borda bg-superficie-2 text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco">
          <tr>
            <th scope="col" className="px-3 py-2 text-center w-8">
              #
            </th>
            {renderTh('dupla', 'Dupla', 'left')}
            {renderTh('pontos', 'Pts', 'center')}
            {renderTh('partidas', 'J', 'center')}
            {renderTh('vitorias', 'V/E/D', 'center')}
            {renderTh('percentual', '%', 'right')}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {pares.map((par, i) => (
            <tr
              key={`${par.jogador_a_id}-${par.jogador_b_id}`}
              className="hover:bg-superficie-2 transition"
            >
              <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-giz-fraco">
                {inicio + i}
              </td>
              <td className="px-3 py-2.5 font-bold text-giz whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5 shrink-0">
                    <Avatar nome={par.jogador_a_nome} size="xs" />
                    <Avatar nome={par.jogador_b_nome} size="xs" />
                  </div>
                  <span>
                    {par.jogador_a_nome} + {par.jogador_b_nome}
                  </span>
                </div>
              </td>
              <td
                className={`px-3 py-2.5 text-center font-mono text-xs font-bold tabular-nums ${
                  colunaOrdenacao === 'pontos' ? 'text-destaque font-black' : 'text-destaque'
                }`}
              >
                {par.pontos}
              </td>
              <td
                className={`px-3 py-2.5 text-center font-mono text-xs tabular-nums ${
                  colunaOrdenacao === 'partidas' ? 'font-bold text-giz' : 'text-giz-fraco'
                }`}
              >
                {par.partidas}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-[11px] font-mono whitespace-nowrap ${
                  colunaOrdenacao === 'vitorias' ? 'font-bold text-giz' : 'text-giz-fraco'
                }`}
              >
                {par.vitorias}V {par.empates}E {par.derrotas}D
              </td>
              <td
                className={`px-3 py-2.5 text-right font-mono text-xs tabular-nums font-semibold ${
                  colunaOrdenacao === 'percentual' ? 'font-bold text-destaque' : 'text-giz'
                }`}
              >
                {par.percentual === null ? '—' : `${Math.round(par.percentual * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
