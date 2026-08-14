import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isRandomUsername } from "../lib/jogadores";
import { useSessao } from "../context/SessaoContext";
import { Carregando, MensagemEstado } from "../components/Estado";
import { PullToRefresh } from "../components/PullToRefresh";
import { Avatar } from "../components/Avatar";

// Mínimo de partidas juntos para uma parceria entrar nas estatísticas
// (mesmo valor do DEFAULT 5 das RPCs parcerias_jogador / parcerias_destaque_jogador).
const MIN_PARTIDAS = 5;

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
  tipo: "companheiro" | "adversario";
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
type MetricaDestaque = "mais_gols" | "melhor_nota" | "pior_nota";

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
  const [jogadorSelecionadoId, setJogadorSelecionadoId] = useState<
    number | null
  >(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [parcerias, setParcerias] = useState<Parceria[]>([]);
  const [destaques, setDestaques] = useState<Record<MetricaDestaque, ParceriaDestaque | undefined>>({
    mais_gols: undefined,
    melhor_nota: undefined,
    pior_nota: undefined,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega lista de jogadores ativos uma vez, filtrando os "random".
  useEffect(() => {
    if (!jogador) return;
    supabase
      .from("jogadores")
      .select("id, nome, username")
      .eq("is_ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (error || !data) return;
        const filtrados = data.filter(
          (j) => !isRandomUsername(j.username),
        );
        setJogadores(filtrados);
        // default: o proprio jogador logado
        if (jogadorSelecionadoId === null) {
          setJogadorSelecionadoId(jogador.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogador?.id]);

  const carregar = useCallback(async () => {
    if (!jogadorSelecionadoId) return;
    setCarregando(true);
    setErro(null);

    try {
      const [resStats, resParc, resDest] = await Promise.all([
        supabase
          .from("stats_jogador")
          .select(
            "jogador_id, partidas, gols, assistencias, gols_contra, vitorias",
          )
          .eq("jogador_id", jogadorSelecionadoId)
          .maybeSingle(),
        supabase.rpc("parcerias_jogador", {
          p_jogador_id: jogadorSelecionadoId,
          p_min_partidas: MIN_PARTIDAS,
        }),
        supabase.rpc("parcerias_destaque_jogador", {
          p_jogador_id: jogadorSelecionadoId,
          p_min_partidas: MIN_PARTIDAS,
        }),
      ]);

      if (resStats.error) {
        setErro(resStats.error.message);
        return;
      }
      if (resParc.error) {
        setErro(resParc.error.message);
        return;
      }
      if (resDest.error) {
        setErro(resDest.error.message);
        return;
      }
      setStats(resStats.data);
      setParcerias(resParc.data ?? []);
      const mapa: Record<MetricaDestaque, ParceriaDestaque | undefined> = {
        mais_gols: undefined,
        melhor_nota: undefined,
        pior_nota: undefined,
      };
      for (const d of (resDest.data ?? []) as ParceriaDestaque[]) {
        mapa[d.metrica] = d;
      }
      setDestaques(mapa);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, [jogadorSelecionadoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!jogador) return null;
  if (carregando) return <Carregando>Carregando estatísticas</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );

  const companheiros = parcerias.filter((p) => p.tipo === "companheiro");
  const adversarios = parcerias.filter((p) => p.tipo === "adversario");
  const melhorComp = companheiros[0];
  const piorComp = companheiros[companheiros.length - 1];
  const melhorAdv = adversarios[0];
  const piorAdv = adversarios[adversarios.length - 1];

  const semParcerias = companheiros.length === 0 && adversarios.length === 0;

  const nomeSelecionado =
    jogadores.find((j) => j.id === jogadorSelecionadoId)?.nome ?? null;

  return (
    <PullToRefresh onRefresh={carregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Estatísticas{nomeSelecionado ? ` · ${nomeSelecionado}` : ""}
      </h2>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        <NavLink
          to="/estatisticas/jogador"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Jogador
        </NavLink>
        <NavLink
          to="/estatisticas/racha"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Racha
        </NavLink>
      </div>

      {/* Dropdown de jogador */}
      <div>
        <label
          htmlFor="select-jogador-stats"
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1"
        >
          Ver estatísticas de
        </label>
        <select
          id="select-jogador-stats"
          value={jogadorSelecionadoId ?? ""}
          onChange={(e) => setJogadorSelecionadoId(Number(e.target.value))}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        >
          {jogadores.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nome}
              {j.id === jogador?.id ? " (eu)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Estatísticas básicas */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Estatísticas básicas
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
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Parcerias
        </h3>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-1 mb-3">
          Mínimo de {MIN_PARTIDAS} partidas juntos.
        </p>

        {semParcerias ? (
          <MensagemEstado tipo="info">
            Ainda não há parcerias com {MIN_PARTIDAS}+ partidas.
          </MensagemEstado>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Companheiros de time
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ParceriaCard
                  titulo="Melhor companheiro"
                  parceria={melhorComp}
                />
                <ParceriaCard titulo="Pior companheiro" parceria={piorComp} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Adversários
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ParceriaCard titulo="Melhor % contra" parceria={melhorAdv} />
                <ParceriaCard titulo="Pior % contra" parceria={piorAdv} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Gols &amp; notas por companheiro
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <ParceriaDestaqueCard
                  titulo="Mais gols junto"
                  metrica="mais_gols"
                  destaque={destaques.mais_gols}
                />
                <ParceriaDestaqueCard
                  titulo="Melhor média nota"
                  metrica="melhor_nota"
                  destaque={destaques.melhor_nota}
                />
                <ParceriaDestaqueCard
                  titulo="Pior média nota"
                  metrica="pior_nota"
                  destaque={destaques.pior_nota}
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
}

function ParceriaDestaqueCard({ titulo, metrica, destaque }: ParceriaDestaqueCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
          {titulo}
        </h4>
        {destaque && (
          <span className="inline-flex items-center shrink-0 rounded-full bg-(--cor-destaque)/10 px-2 py-0.5 text-xs font-extrabold text-(--cor-destaque)">
            {metrica === "mais_gols"
              ? `${destaque.valor ?? 0} gols`
              : (destaque.valor ?? 0).toFixed(1)}
          </span>
        )}
      </div>

      {!destaque ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="flex items-center gap-2.5">
          <Avatar nome={destaque.nome} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {destaque.nome}
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {destaque.partidas} partidas juntas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 px-2 py-2.5 text-center shadow-xs">
      <div className="text-xl sm:text-2xl font-extrabold text-(--cor-destaque)">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
    </div>
  );
}

interface ParceriaCardProps {
  titulo: string;
  parceria?: Parceria;
}

function ParceriaCard({ titulo, parceria }: ParceriaCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
          {titulo}
        </h4>
        {parceria && (
          <span className="inline-flex items-center shrink-0 rounded-full bg-(--cor-destaque)/10 px-2 py-0.5 text-xs font-extrabold text-(--cor-destaque)">
            {Math.round((parceria.percentual ?? 0) * 100)}%
          </span>
        )}
      </div>

      {!parceria ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar nome={parceria.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {parceria.nome}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {parceria.partidas} partidas
              </p>
            </div>
          </div>
          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>Retrospecto</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {parceria.vitorias}V {parceria.empates}E {parceria.derrotas}D
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
