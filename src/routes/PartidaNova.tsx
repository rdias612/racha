import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { type TimeId, type PosicaoId } from "../lib/times";
import { Carregando, MensagemEstado } from "../components/Estado";

interface ParticipanteForm {
  jogador: JogadorLista;
  time: TimeId;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
}

const LIMITE_POR_TIME = 8;

export function PartidaNova() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dataJogo, setDataJogo] = useState("");
  const [horaJogo, setHoraJogo] = useState("20:00");
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    listarJogadoresAtivos()
      .then(setJogadores)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const p of participantes) c[p.time]++;
    return c;
  }, [participantes]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando jogadores</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Erro: {erro}
      </MensagemEstado>
    );

  function timeDoJogador(id: number): TimeId | null {
    return participantes.find((p) => p.jogador.id === id)?.time ?? null;
  }

  function atribuirTime(id: number, time: TimeId) {
    setFeedback(null);
    setParticipantes((prev) => {
      const idx = prev.findIndex((p) => p.jogador.id === id);
      // Já está nesse time -> remove (não joga)
      if (idx !== -1 && prev[idx].time === time) {
        return prev.filter((p) => p.jogador.id !== id);
      }
      // Está no outro time -> troca
      if (idx !== -1) {
        return prev.map((p) =>
          p.jogador.id === id ? { ...p, time } : p,
        );
      }
      // Não está -> adiciona (bloqueia se o time alvo já está cheio)
      const cheio =
        prev.filter((p) => p.time === time).length >= LIMITE_POR_TIME;
      if (cheio) return prev;
      const jogador = jogadores.find((j) => j.id === id)!;
      return [
        ...prev,
        {
          jogador,
          time,
          posicao: jogador.posicao,
          gols: 0,
          assistencias: 0,
          gols_contra: 0,
        },
      ];
    });
  }

  const podeSalvar =
    contagemTime.a === LIMITE_POR_TIME &&
    contagemTime.b === LIMITE_POR_TIME &&
    !!dataJogo &&
    !salvando;

  async function salvarComoDraft() {
    if (!adminLogado || !podeSalvar) return;
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    const dataIso = new Date(`${dataJogo}T${horaJogo}`).toISOString();
    const payload = participantes.map((p) => ({
      jogador_id: p.jogador.id,
      time: p.time,
      posicao: p.posicao,
      gols: p.gols,
      assistencias: p.assistencias,
      gols_contra: p.gols_contra,
    }));

    const { data, error } = await supabase.rpc("criar_partida", {
      p_data_jogo: dataIso,
      p_criado_por: adminLogado.id,
      p_participantes: payload,
    });

    setSalvando(false);

    if (error) {
      setErro("Erro ao criar partida: " + error.message);
      return;
    }
    if (data === null) {
      setErro("Falha ao criar partida (rollback). Verifique os dados.");
      return;
    }

    setFeedback(`Partida #${data} criada como rascunho.`);
    setTimeout(() => navigate(`/partida/${data}`, { replace: true }), 800);
  }

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-neutral-500 dark:text-neutral-400 mb-2"
        >
          ← voltar
        </button>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Nova partida
        </h2>
      </div>

      {/* Data */}
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Data
          </span>
          <input
            type="date"
            value={dataJogo}
            onChange={(e) => setDataJogo(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="w-28">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Hora
          </span>
          <input
            type="time"
            value={horaJogo}
            onChange={(e) => setHoraJogo(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>
      </div>

      {/* Contagem por time */}
      <div className="flex gap-3">
        {(["a", "b"] as TimeId[]).map((t) => {
          const qtd = contagemTime[t];
          const cheio = qtd >= LIMITE_POR_TIME;
          const rotulo = t === "a" ? "Preto" : "Branco";
          return (
            <div
              key={t}
              className={`flex-1 rounded-lg border px-3 py-2 flex items-center justify-between transition ${
                cheio
                  ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <span className="text-sm font-medium">{rotulo}</span>
              <span className="text-sm font-semibold tabular-nums">
                {cheio ? "✓ " : ""}
                {qtd}/{LIMITE_POR_TIME}
              </span>
            </div>
          );
        })}
      </div>

      {/* Lista de jogadores com botões Preto/Branco */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Jogadores
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Toque em Preto ou Branco para escalar
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden">
          {jogadores.map((j) => {
            const time = timeDoJogador(j.id);
            const neutro = time === null;
            const pretoCheio =
              contagemTime.a >= LIMITE_POR_TIME && time !== "a";
            const brancoCheio =
              contagemTime.b >= LIMITE_POR_TIME && time !== "b";
            return (
              <div
                key={j.id}
                className={`flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 ${
                  neutro ? "opacity-60" : ""
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {j.nome}
                </span>
                <div className="shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => atribuirTime(j.id, "a")}
                    disabled={pretoCheio}
                    aria-pressed={time === "a"}
                    aria-label={`Escalar ${j.nome} no time Preto`}
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-lg border text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      time === "a"
                        ? "bg-neutral-900 text-neutral-50 border-neutral-900 dark:bg-neutral-800 dark:border-neutral-400"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    Preto
                  </button>
                  <button
                    type="button"
                    onClick={() => atribuirTime(j.id, "b")}
                    disabled={brancoCheio}
                    aria-pressed={time === "b"}
                    aria-label={`Escalar ${j.nome} no time Branco`}
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-lg border text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      time === "b"
                        ? "bg-neutral-100 dark:bg-neutral-200 text-neutral-900 border-neutral-300 dark:border-neutral-300"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    Branco
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {jogadores.length < LIMITE_POR_TIME * 2 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Aviso: há apenas {jogadores.length} jogadores ativos. Uma partida
            precisa de {LIMITE_POR_TIME * 2}.
          </p>
        )}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && (
        <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>
      )}

      <div
        className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={salvarComoDraft}
            disabled={!podeSalvar}
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition"
          >
            {salvando ? "Salvando…" : "Salvar rascunho"}
          </button>
          {!podeSalvar && (
            <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Precisa de 8 jogadores por time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
