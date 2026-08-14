import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessao } from "../context/SessaoContext";
import { Carregando, MensagemEstado } from "../components/Estado";
import { PullToRefresh } from "../components/PullToRefresh";
import { Avatar } from "../components/Avatar";
import { vibrateLight } from "../lib/haptics";
import { Sparkles, Users, Swords, Flame } from "lucide-react";

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
          (j) => !/^random[1-6]$/.test(j.username),
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
          p_min_partidas: 5,
        }),
        supabase.rpc("parcerias_destaque_jogador", {
          p_jogador_id: jogadorSelecionadoId,
          p_min_partidas: 5,
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
  if (carregando) return <Carregando>Carregando estatísticas e parcerias</Carregando>;
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
        <div>
          <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
            Raio-X do Atleta{nomeSelecionado ? ` · ${nomeSelecionado}` : ""}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Estatísticas individuais e afinidade tática no racha
          </p>
        </div>

        {/* Alternador de visualização */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
          <NavLink
            to="/estatisticas/jogador"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Jogador
          </NavLink>
          <NavLink
            to="/estatisticas/racha"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Racha &amp; Duplas
          </NavLink>
        </div>

        {/* Dropdown de jogador */}
        <div>
          <label
            htmlFor="select-jogador-stats"
            className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1"
          >
            Ver estatísticas de
          </label>
          <select
            id="select-jogador-stats"
            value={jogadorSelecionadoId ?? ""}
            onChange={(e) => {
              vibrateLight();
              setJogadorSelecionadoId(Number(e.target.value));
            }}
            className="w-full cursor-pointer rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm font-medium text-neutral-900 dark:text-neutral-100 shadow-xs"
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            Números na Carreira
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Química &amp; Parcerias (Mín. 5 Partidas)
            </h3>
            <Sparkles className="size-3.5 text-amber-500" />
          </div>

          {semParcerias ? (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-5 text-center shadow-xs">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Ainda não há parcerias com 5+ partidas no racha.
              </p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                Menos chinelinho e mais presença no Gragoatá pra destravar o entrosamento com a rapaziada!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                  <Users className="size-3.5 text-emerald-500" />
                  Companheiros de time
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ParceriaCard
                    titulo="Dupla Dinâmica"
                    subtitulo="Casamento perfeito"
                    parceria={melhorComp}
                  />
                  <ParceriaCard
                    titulo="Dupla do Desastre"
                    subtitulo="Falta entrosamento"
                    parceria={piorComp}
                  />
                </div>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                  <Swords className="size-3.5 text-red-500" />
                  Adversários
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ParceriaCard
                    titulo="Freguês Favorito"
                    subtitulo="Retrospecto dominante"
                    parceria={melhorAdv}
                  />
                  <ParceriaCard
                    titulo="Pedra no Sapato"
                    subtitulo="Carrasco do clássico"
                    parceria={piorAdv}
                  />
                </div>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                  <Flame className="size-3.5 text-amber-500" />
                  Gols &amp; Notas por Companheiro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ParceriaDestaqueCard
                    titulo="Fábrica de Gols"
                    subtitulo="Mais gols juntos"
                    metrica="mais_gols"
                    destaque={destaques.mais_gols}
                  />
                  <ParceriaDestaqueCard
                    titulo="Sinergia Máxima"
                    subtitulo="Melhor média de nota"
                    metrica="melhor_nota"
                    destaque={destaques.melhor_nota}
                  />
                  <ParceriaDestaqueCard
                    titulo="Incompatibilidade"
                    subtitulo="Pior média de nota"
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
  subtitulo?: string;
  metrica: MetricaDestaque;
  destaque?: ParceriaDestaque;
}

function ParceriaDestaqueCard({ titulo, subtitulo, metrica, destaque }: ParceriaDestaqueCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 truncate">
            {titulo}
          </h4>
          {subtitulo && (
            <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
              {subtitulo}
            </p>
          )}
        </div>
        {destaque && (
          <span className="font-scoreboard inline-flex items-center shrink-0 rounded-full bg-(--cor-destaque)/10 px-2 py-0.5 text-sm font-black text-(--cor-destaque)">
            {metrica === "mais_gols"
              ? `${destaque.valor ?? 0} gols`
              : (destaque.valor ?? 0).toFixed(1)}
          </span>
        )}
      </div>

      {!destaque ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 italic">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2.5">
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
      <div className="font-scoreboard text-2xl sm:text-3xl font-black text-(--cor-destaque) leading-tight">
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
    </div>
  );
}

interface ParceriaCardProps {
  titulo: string;
  subtitulo?: string;
  parceria?: Parceria;
}

function ParceriaCard({ titulo, subtitulo, parceria }: ParceriaCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 truncate">
            {titulo}
          </h4>
          {subtitulo && (
            <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
              {subtitulo}
            </p>
          )}
        </div>
        {parceria && (
          <span className="font-scoreboard inline-flex items-center shrink-0 rounded-full bg-(--cor-destaque)/10 px-2 py-0.5 text-sm font-black text-(--cor-destaque)">
            {Math.round((parceria.percentual ?? 0) * 100)}%
          </span>
        )}
      </div>

      {!parceria ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 italic">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar nome={parceria.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {parceria.nome}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {parceria.partidas} jogos juntos
              </p>
            </div>
          </div>
          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            <span>Retrospecto</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {parceria.vitorias}V {parceria.empates}E {parceria.derrotas}D
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
