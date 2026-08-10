import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessao } from "../context/SessaoContext";
import { Carregando, MensagemEstado } from "../components/Estado";

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

  // Busca as estatisticas do jogador selecionado.
  useEffect(() => {
    if (!jogadorSelecionadoId) return;
    setCarregando(true);
    setErro(null);

    // busca paralela: stats básicas + parcerias
    Promise.all([
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
    ]).then(([resStats, resParc]) => {
      if (resStats.error) {
        setErro(resStats.error.message);
        setCarregando(false);
        return;
      }
      if (resParc.error) {
        setErro(resParc.error.message);
        setCarregando(false);
        return;
      }
      setStats(resStats.data);
      setParcerias(resParc.data ?? []);
      setCarregando(false);
    });
  }, [jogadorSelecionadoId]);

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

      {/* Estatísticas básicas (duplicado do Perfil) */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Estatísticas básicas
        </h3>
        <div className="grid grid-cols-5 gap-2">
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

        {semParcerias ? (
          <MensagemEstado tipo="info">
            Ainda não há parcerias com 5+ partidas.
          </MensagemEstado>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Companheiros de time
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ParceriaCard titulo="Melhor % contra" parceria={melhorAdv} />
                <ParceriaCard titulo="Pior % contra" parceria={piorAdv} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-2 py-3 text-center">
      <div className="text-2xl font-bold text-(--cor-destaque)">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
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
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {titulo}
      </h4>
      {!parceria ? (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <>
          <p className="mt-2 text-base font-bold text-neutral-900 dark:text-neutral-100">
            {parceria.nome}
          </p>
          <p className="mt-0.5 text-sm font-medium text-(--cor-destaque)">
            {Math.round((parceria.percentual ?? 0) * 100)}%
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {parceria.partidas} partidas · {parceria.vitorias}V{" "}
            {parceria.empates}E {parceria.derrotas}D
          </p>
        </>
      )}
    </div>
  );
}
