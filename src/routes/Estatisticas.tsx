import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isRandomUsername } from '../lib/jogadores';
import { useSessao } from '../context/SessaoContext';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { MensagemEstado } from '../components/Estado';
import { SkeletonEstatisticas } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { Avatar } from '../components/Avatar';

const DEFAULT_MIN_PARTIDAS = 5;

// Stats básicas (mesma fonte do Perfil: view stats_jogador)
interface Stats {
  jogador_id: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
}

// Parcerias (RPC nova)
interface Parceria {
  tipo: 'companheiro' | 'adversario';
  outro_jogador_id: number;
  nome: string;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  percentual: number | null;
}

// Destaques (RPC 042) - 3 metricas de companheiro de time:
//   - mais_gols: Soma de gols do PROPRIO usuario nas partidas compartilhadas.
//   - melhor_nota / pior_nota: AVG(partida_notas.avg_rating) do proprio usuario.
type MetricaDestaque = 'mais_gols' | 'melhor_nota' | 'pior_nota';

interface ParceriaDestaque {
  metrica: MetricaDestaque;
  outro_jogador_id: number;
  nome: string;
  partidas: number;
  valor: number | null;
}

// Item do dropdown de jogadores
interface JogadorOpcao {
  id: number;
  nome: string;
  username: string;
}

export function Estatisticas() {
  const { jogador } = useSessao();
  const [jogadores, setJogadores] = useState<JogadorOpcao[]>([]);
  const [jogadorSelecionadoId, setJogadorSelecionadoId] = useState<number | null>(null);
  const [minimoPartidas, setMinimoPartidas] = useState(DEFAULT_MIN_PARTIDAS);
  const [stats, setStats] = useState<Stats | null>(null);
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

  // Carrega lista de jogadores ativos uma vez, filtrando os "random".
  useEffect(() => {
    if (!jogadorId) return;
    supabase
      .from('jogadores')
      .select('id, nome, username')
      .eq('is_ativo', true)
      .order('nome')
      .then(({ data, error }) => {
        if (error || !data) return;
        const filtrados = data.filter((j) => !isRandomUsername(j.username));
        setJogadores(filtrados);
        // default: o proprio jogador logado
        setJogadorSelecionadoId((curr) => (curr === null ? jogadorId : curr));
      });
  }, [jogadorId]);

  const carregar = useCallback(async () => {
    if (jogadorSelecionadoId === null) return;
    setCarregando(true);
    setErro(null);

    try {
      // Busca stats basicas, parcerias e destaques em paralelo
      const [resStats, resParcerias, resDestaques] = await Promise.all([
        supabase
          .from('stats_jogador')
          .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
          .eq('jogador_id', jogadorSelecionadoId)
          .maybeSingle(),
        supabase.rpc('parcerias_jogador', {
          p_jogador_id: jogadorSelecionadoId,
        }),
        supabase.rpc('parcerias_destaque_jogador', {
          p_jogador_id: jogadorSelecionadoId,
        }),
      ]);

      if (resStats.error) throw resStats.error;
      if (resParcerias.error) throw resParcerias.error;
      if (resDestaques.error) throw resDestaques.error;

      setStats(resStats.data);
      setParcerias(resParcerias.data ?? []);

      // Mapeia array de destaques para lookup facil por metrica
      const mapaDestaques: Record<MetricaDestaque, ParceriaDestaque | undefined> = {
        mais_gols: undefined,
        melhor_nota: undefined,
        pior_nota: undefined,
      };
      for (const d of (resDestaques.data ?? []) as ParceriaDestaque[]) {
        if (d.metrica in mapaDestaques) {
          mapaDestaques[d.metrica] = d;
        }
      }
      setDestaques(mapaDestaques);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setCarregando(false);
    }
  }, [jogadorSelecionadoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) return <SkeletonEstatisticas />;
  if (erro) {
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;
  }

  // Filtra parcerias pelo minimo de partidas
  const parceriasFiltradas = parcerias.filter((p) => p.partidas >= minimoPartidas);

  const comps = parceriasFiltradas.filter((p) => p.tipo === 'companheiro');
  const advs = parceriasFiltradas.filter((p) => p.tipo === 'adversario');

  // Ordena por aproveitamento (percentual)
  const compsOrdenados = [...comps].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));
  const advsOrdenados = [...advs].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));

  const melhorComp = compsOrdenados[0];
  const piorComp =
    compsOrdenados.length > 1 ? compsOrdenados[compsOrdenados.length - 1] : undefined;

  const melhorAdv = advsOrdenados[0];
  const piorAdv = advsOrdenados.length > 1 ? advsOrdenados[advsOrdenados.length - 1] : undefined;

  const maximoPartidas = Math.max(DEFAULT_MIN_PARTIDAS, ...parcerias.map((p) => p.partidas));

  const nomeSelecionado = jogadores.find((j) => j.id === jogadorSelecionadoId)?.nome ?? '';

  const semParcerias = !melhorComp && !piorComp && !melhorAdv && !piorAdv;

  return (
    <PullToRefresh onRefresh={carregar}>
      <div
        className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 touch-pan-y text-giz"
        {...swipeHandlers}
      >
        {/* Cabeçalho da Súmula */}
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Estatísticas{nomeSelecionado ? ` · ${nomeSelecionado}` : ''}
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
            className="w-full rounded-[3px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-medium focus:outline-none focus:border-destaque"
          >
            {jogadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nome}
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
              <span className="font-mono text-destaque">{minimoPartidas} jogos</span>
            </div>
            <input
              id="filtro-minimo-partidas"
              type="range"
              min="1"
              max={maximoPartidas}
              value={minimoPartidas}
              onChange={(e) => setMinimoPartidas(Number(e.target.value))}
              className="w-full accent-[#ffb300]"
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
          <span className="font-mono text-xs font-black text-destaque tabular-nums">
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
          <Avatar nome={destaque.nome} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-giz">{destaque.nome}</p>
            <p className="text-[11px] font-mono text-giz-fraco">
              {destaque.partidas} {destaque.partidas === 1 ? 'partida junta' : 'partidas juntas'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[4px] border border-borda bg-superficie px-2 py-2.5 text-center shadow-carimbo">
      <div className="font-mono text-xl sm:text-2xl font-black text-destaque tabular-nums">
        {value}
      </div>
      <div className="font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco">
        {label}
      </div>
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
          <span className="font-mono text-xs font-black text-destaque tabular-nums">
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
            <Avatar nome={parceria.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-giz">{parceria.nome}</p>
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
