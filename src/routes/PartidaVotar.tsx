import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
} from "../lib/partidas";
import { POSICOES, TIMES, type PosicaoId, type TimeId } from "../lib/times";
import { Carregando, MensagemEstado } from "../components/Estado";
import { SeletorNota } from "../components/SeletorNota";

interface Alvo {
  jogador_id: number;
  nome: string;
  posicao: PosicaoId;
  time: TimeId;
}

export function PartidaVotar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jogador = useJogadorLogado();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [alvos, setAlvos] = useState<Alvo[]>([]);
  const [notas, setNotas] = useState<Record<number, number>>({});
  const [votosOriginais, setVotosOriginais] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!id || !jogador) return;
      try {
        const p = await carregarPartida(Number(id));
        if (!p) {
          setErro("Partida não encontrada.");
          setCarregando(false);
          return;
        }
        setPartida(p);

        // valida janela
        const aberta =
          p.status === "published" &&
          p.voting_closes_at &&
          new Date(p.voting_closes_at) > new Date();
        if (!aberta) {
          setErro("A votação para esta partida não está aberta.");
          setCarregando(false);
          return;
        }

        const participantes = await carregarParticipantes(p.id);
        // esconde o próprio votante (não vota em si)
        const alvosFiltrados = participantes
          .filter((part) => part.jogador_id !== jogador.id)
          .map((part) => ({
            jogador_id: part.jogador_id,
            nome: part.nome ?? "?",
            posicao: part.posicao,
            time: part.time,
          }));
        setAlvos(alvosFiltrados);

        // pré-carrega votos já dados (pra permitir edição)
        const { data: meusVotos } = await supabase
          .from("votes")
          .select("target_id, rating")
          .eq("partida_id", p.id)
          .eq("voter_id", jogador.id);

        const notasIniciais: Record<number, number> = {};
        const originais = new Set<number>();
        for (const v of meusVotos ?? []) {
          notasIniciais[v.target_id] = v.rating;
          originais.add(v.target_id);
        }
        setNotas(notasIniciais);
        setVotosOriginais(originais);
      } catch (e: any) {
        setErro(e.message ?? String(e));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, jogador?.id]);

  if (!jogador) return <Navigate to="/login" replace />;
  if (carregando) return <Carregando>Carregando votação</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );
  if (!partida) return null;

  function setNota(targetId: number, rating: number) {
    setFeedback(null);
    setNotas((prev) => ({ ...prev, [targetId]: rating }));
  }

  const todosAvaliados = alvos.every((a) => notas[a.jogador_id] !== undefined);
  const editando = votosOriginais.size > 0;

  async function enviar() {
    if (!jogador || !partida || !todosAvaliados) return;
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    const payload = alvos.map((a) => ({
      target_id: a.jogador_id,
      rating: notas[a.jogador_id],
    }));

    const { data, error } = await supabase.rpc("registrar_votos", {
      p_partida_id: partida.id,
      p_voter_id: jogador.id,
      p_votos: payload,
    });

    setSalvando(false);

    if (error) {
      setErro("Erro ao registrar votos: " + error.message);
      return;
    }
    if (data === false) {
      setErro(
        "Não foi possível registrar (a votação pode ter fechado ou há voto inválido).",
      );
      return;
    }

    setFeedback(editando ? "Votos atualizados!" : "Votos registrados!");
    setTimeout(
      () => navigate(`/partida/${partida.id}`, { replace: true }),
      900,
    );
  }

  const tempoRestante = partida.voting_closes_at
    ? Math.max(0, new Date(partida.voting_closes_at).getTime() - Date.now())
    : 0;
  const horasRestantes = Math.floor(tempoRestante / (1000 * 60 * 60));
  const minutosRestantes = Math.floor(
    (tempoRestante % (1000 * 60 * 60)) / (1000 * 60),
  );

  return (
    <div className="px-3 py-4 pb-24 sm:px-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {editando ? "Editar votos" : "Votação"} — partida #{partida.id}
        </h2>
        <p className="text-xs text-[var(--cor-destaque)]">
          ⏳ Fecha em {horasRestantes}h {minutosRestantes}min
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Dê uma nota de 1 a 10 para cada jogador. O craque será definido pela
          média. Votos anônimos.
        </p>
      </div>

      <div className="space-y-4">
        {(["a", "b"] as TimeId[]).map((t) => {
          const jogadoresDoTime = alvos
            .filter((a) => a.time === t)
            .sort((a, b) =>
              a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
            );
          if (jogadoresDoTime.length === 0) return null;
          return (
            <div
              key={t}
              className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div
                className="px-3 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === "a" ? "#f9fafb" : "#111827",
                }}
              >
                {TIMES[t].nome}
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {jogadoresDoTime.map((a) => {
                  const nota = notas[a.jogador_id];
                  return (
                    <div
                      key={a.jogador_id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {a.nome}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                          {POSICOES[a.posicao]}
                        </span>
                      </div>
                      <SeletorNota
                        variant="compact"
                        value={nota}
                        onChange={(n) => setNota(a.jogador_id, n)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      <div className="fixed inset-x-0 bottom-16 z-40 p-3 pb-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={enviar}
            disabled={!todosAvaliados || salvando}
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {salvando
              ? "Enviando…"
              : editando
                ? "Atualizar votos"
                : todosAvaliados
                  ? "Enviar votos"
                  : `Avalie todos (${alvos.length - Object.keys(notas).length} restantes)`}
          </button>
        </div>
      </div>
    </div>
  );
}
