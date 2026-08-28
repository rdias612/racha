import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  carregarParceriasDestaque,
  carregarParceriasJogador,
  carregarStatsJogador,
  listarJogadoresAtivosSemRandom,
  type MetricaDestaque,
  type Parceria,
  type ParceriaDestaque,
  type StatsJogador,
} from '../lib/jogadores';
import { useSessao } from '../context/SessaoContext';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { MensagemEstado } from '../components/Estado';
import { SkeletonEstatisticas } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { Avatar } from '../components/Avatar';
import { AbasEstatisticas } from '../components/AbasEstatisticas';
import { StatBox } from '../components/StatBox';
import { formatarMensagemErro } from '../lib/erros';

const DEFAULT_MIN_PARTIDAS = 5;

// Item do dropdown de jogadores
interface JogadorOpcao {
  id: number;
  username: string;
}

export function Estatisticas() {
  const { jogador } = useSessao();
  const [jogadores, setJogadores] = useState<JogadorOpcao[]>([]);
  const [jogadorSelecionadoId, setJogadorSelecionadoId] = useState<number | null>(null);
  const [minimoPartidas, setMinimoPartidas] = useState(DEFAULT_MIN_PARTIDAS);
  const [stats, setStats] = useState<StatsJogador | null>(null);
  const [parcerias, setParcerias] = useState<Parceria[]>([]);
  const [destaques, setDestaques] = useState<Record<MetricaDestaque, ParceriaDestaque | undefined>>(
    {
      mais_gols: undefined,
      melhor_nota: undefined,
      pior_nota: undefined,
    }
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ['/estatisticas/jogador', '/estatisticas/racha', '/estatisticas/comparar'],
    activeTab: '/estatisticas/jogador',
  });

  const jogadorId = jogador?.id;

  // Carrega o elenco real ativo (randoms já filtrados na lib) uma vez.
  useEffect(() => {
    if (!jogadorId) return;
    let ativo = true;
    listarJogadoresAtivosSemRandom()
      .then((lista) => {
        if (!ativo) return;
        setJogadores(lista);
        // default: o proprio jogador logado
        setJogadorSelecionadoId((curr) => (curr === null ? jogadorId : curr));
      })
      .catch(() => {
        // Lista indisponível: seletor fica vazio (mesma tolerância do Comparador).
      });
    return () => {
      ativo = false;
    };
  }, [jogadorId]);

  // Geração de requisição: `carregar` também é usado pelo PullToRefresh (fora
  // do ciclo de useEffect), então a proteção contra resposta obsoleta — trocar
  // o jogador selecionado durante o fetch — vive aqui, não na flag do efeito.
  const geracaoRef = useRef(0);

  const carregar = useCallback(async () => {
    if (jogadorSelecionadoId === null) return;
    const geracao = ++geracaoRef.current;
    setCarregando(true);
    setErro(null);

    try {
      // Busca stats basicas, parcerias e destaques em paralelo (libs lançam cru)
      const [dadosStats, parcerias, destaques] = await Promise.all([
        carregarStatsJogador(jogadorSelecionadoId),
        carregarParceriasJogador(jogadorSelecionadoId),
        carregarParceriasDestaque(jogadorSelecionadoId),
      ]);

      if (geracao !== geracaoRef.current) return;

      setStats(dadosStats);
      setParcerias(parcerias);

      // Mapeia array de destaques para lookup facil por metrica
      const mapaDestaques: Record<MetricaDestaque, ParceriaDestaque | undefined> = {
        mais_gols: undefined,
        melhor_nota: undefined,
        pior_nota: undefined,
      };
      for (const d of destaques) {
        mapaDestaques[d.metrica] = d;
      }
      setDestaques(mapaDestaques);
    } catch (e) {
      if (geracao === geracaoRef.current) {
        setErro(formatarMensagemErro(e, 'Erro ao carregar dados.'));
      }
    } finally {
      if (geracao === geracaoRef.current) setCarregando(false);
    }
  }, [jogadorSelecionadoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const maximoPartidas = useMemo(
    () => Math.max(DEFAULT_MIN_PARTIDAS, ...parcerias.map((p) => p.partidas)),
    [parcerias]
  );

  const parceriasFiltradas = useMemo(
    () => parcerias.filter((p) => p.partidas >= minimoPartidas),
    [parcerias, minimoPartidas]
  );

  const { melhorComp, piorComp, melhorAdv, piorAdv } = useMemo(() => {
    const comps = parceriasFiltradas.filter((p) => p.tipo === 'companheiro');
    const advs = parceriasFiltradas.filter((p) => p.tipo === 'adversario');

    const compsOrdenados = [...comps].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));
    const advsOrdenados = [...advs].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));

    return {
      melhorComp: compsOrdenados[0],
      piorComp: compsOrdenados.length > 1 ? compsOrdenados[compsOrdenados.length - 1] : undefined,
      melhorAdv: advsOrdenados[0],
      piorAdv: advsOrdenados.length > 1 ? advsOrdenados[advsOrdenados.length - 1] : undefined,
    };
  }, [parceriasFiltradas]);

  const usernameSelecionado = useMemo(
    () => jogadores.find((j) => j.id === jogadorSelecionadoId)?.username ?? '',
    [jogadores, jogadorSelecionadoId]
  );

  const semParcerias = !melhorComp && !piorComp && !melhorAdv && !piorAdv;

  if (carregando) return <SkeletonEstatisticas />;
  if (erro) {
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;
  }

  return (
    <PullToRefresh onRefresh={carregar}>
      <div
        className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 touch-pan-y text-giz"
        {...swipeHandlers}
      >
        {/* Cabeçalho da Súmula */}
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Estatísticas{usernameSelecionado ? ` · @${usernameSelecionado}` : ''}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Oficial CBO
          </span>
        </div>

        {/* Abas */}
        <AbasEstatisticas />

        {/* Dropdown de jogador */}
        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo space-y-1">
          <label
            htmlFor="select-jogador-stats"
            className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco"
          >
            Atleta em Análise
          </label>
          <select
            id="select-jogador-stats"
            value={jogadorSelecionadoId ?? ''}
            onChange={(e) => setJogadorSelecionadoId(Number(e.target.value))}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz font-medium focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          >
            {jogadores.map((j) => (
              <option key={j.id} value={j.id}>
                @{j.username}
                {j.id === jogador?.id ? ' (eu)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Estatísticas básicas */}
        <section className="space-y-2">
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
            Números na Temporada
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <StatBox label="Partidas" value={stats?.partidas ?? 0} />
            <StatBox label="Vitórias" value={stats?.vitorias ?? 0} />
            <StatBox label="Gols" value={stats?.gols ?? 0} />
            <StatBox label="Assists" value={stats?.assistencias ?? 0} />
            <StatBox label="Gols contra" value={stats?.gols_contra ?? 0} />
          </div>
        </section>

        {/* Parcerias */}
        <section className="space-y-4">
          <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo space-y-1">
            <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
              <span>Mínimo de partidas conjuntas</span>
              <span className="font-mono text-destaque-texto">{minimoPartidas} jogos</span>
            </div>
            <input
              id="filtro-minimo-partidas"
              type="range"
              min="1"
              max={maximoPartidas}
              value={minimoPartidas}
              onChange={(e) => setMinimoPartidas(Number(e.target.value))}
              className="w-full accent-destaque"
            />
          </div>

          {semParcerias ? (
            <MensagemEstado tipo="info">
              Ainda não há {minimoPartidas}+ partidas com nenhum jogador.
            </MensagemEstado>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-display font-bold uppercase tracking-wider text-giz mb-2">
                  Companheiros de Time
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ParceriaCard
                    titulo="Melhor dupla"
                    parceria={melhorComp}
                    minimoPartidas={minimoPartidas}
                  />
                  <ParceriaCard
                    titulo="Pior dupla"
                    parceria={piorComp}
                    minimoPartidas={minimoPartidas}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-display font-bold uppercase tracking-wider text-giz mb-2">
                  Adversários Diretos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ParceriaCard
                    titulo="Melhor % contra"
                    parceria={melhorAdv}
                    minimoPartidas={minimoPartidas}
                  />
                  <ParceriaCard
                    titulo="Pior % contra"
                    parceria={piorAdv}
                    minimoPartidas={minimoPartidas}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-display font-bold uppercase tracking-wider text-giz mb-2">
                  Gols &amp; Notas por Companheiro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ParceriaDestaqueCard
                    titulo="Mais gols junto"
                    metrica="mais_gols"
                    destaque={destaques.mais_gols}
                    minimoPartidas={minimoPartidas}
                  />
                  <ParceriaDestaqueCard
                    titulo="Melhor média nota"
                    metrica="melhor_nota"
                    destaque={destaques.melhor_nota}
                    minimoPartidas={minimoPartidas}
                  />
                  <ParceriaDestaqueCard
                    titulo="Pior média nota"
                    metrica="pior_nota"
                    destaque={destaques.pior_nota}
                    minimoPartidas={minimoPartidas}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </PullToRefresh>
  );
}

interface ParceriaDestaqueCardProps {
  titulo: string;
  metrica: MetricaDestaque;
  destaque?: ParceriaDestaque;
  minimoPartidas: number;
}

function ParceriaDestaqueCard({
  titulo,
  metrica,
  destaque,
  minimoPartidas,
}: ParceriaDestaqueCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco truncate">
          {titulo}
        </h4>
        {destaque && (
          <span className="font-mono text-xs font-black text-destaque-texto tabular-nums">
            {metrica === 'mais_gols'
              ? `${destaque.valor ?? 0} gols`
              : (destaque.valor ?? 0).toFixed(1)}
          </span>
        )}
      </div>

      {!destaque ? (
        <p className="mt-1 text-xs font-mono text-giz-fraco">
          Sem dados suficientes (mín. {minimoPartidas}{' '}
          {minimoPartidas === 1 ? 'partida' : 'partidas'})
        </p>
      ) : (
        <div className="flex items-center gap-2.5">
          <Avatar username={destaque.username} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-giz">@{destaque.username}</p>
            <p className="text-[11px] font-mono text-giz-fraco">
              {destaque.partidas} {destaque.partidas === 1 ? 'partida junta' : 'partidas juntas'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParceriaCardProps {
  titulo: string;
  parceria?: Parceria;
  minimoPartidas: number;
}

function ParceriaCard({ titulo, parceria, minimoPartidas }: ParceriaCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco truncate">
          {titulo}
        </h4>
        {parceria && (
          <span className="font-mono text-xs font-black text-destaque-texto tabular-nums">
            {Math.round((parceria.percentual ?? 0) * 100)}%
          </span>
        )}
      </div>

      {!parceria ? (
        <p className="mt-1 text-xs font-mono text-giz-fraco">
          Sem dados suficientes (mín. {minimoPartidas}{' '}
          {minimoPartidas === 1 ? 'partida' : 'partidas'})
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar username={parceria.username} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-giz">@{parceria.username}</p>
              <p className="text-[11px] font-mono text-giz-fraco">
                {parceria.partidas} {parceria.partidas === 1 ? 'partida' : 'partidas'}
              </p>
            </div>
          </div>
          <div className="pt-1.5 border-t border-borda flex items-center justify-between text-[11px] font-mono text-giz-fraco">
            <span>Retrospecto</span>
            <span className="font-bold text-giz">
              {parceria.vitorias}V {parceria.empates}E {parceria.derrotas}D
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
