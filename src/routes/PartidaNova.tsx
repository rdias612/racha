import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { TIMES, POSICOES, type TimeId, type PosicaoId } from "../lib/times";

interface ParticipanteForm {
  jogador: JogadorLista;
  time: TimeId;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
}

const POSICAO_LABEL: Record<PosicaoId, string> = {
  goleiro: "GOL",
  zagueiro: "ZAG",
  lateral: "LAT",
  meia: "MEI",
  atacante: "ATA",
  random: "RND",
};

export function PartidaNova() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dataJogo, setDataJogo] = useState("");
  const [horaJogo, setHoraJogo] = useState("20:00");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
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
  if (carregando)
    return (
      <div className="p-4 text-sm text-neutral-500">Carregando jogadores…</div>
    );
  if (erro) return <div className="p-4 text-sm text-red-600">Erro: {erro}</div>;

  function toggleSelecao(id: number) {
    setFeedback(null);
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
        setParticipantes((ps) => ps.filter((p) => p.jogador.id !== id));
      } else {
        if (novo.size >= 16) return prev; // máximo 16
        novo.add(id);
        const jogador = jogadores.find((j) => j.id === id)!;
        // distribuição inicial alterna o time pra equilibrar
        const proximoTime: TimeId = novo.size % 2 === 1 ? "a" : "b";
        setParticipantes((ps) => [
          ...ps,
          {
            jogador,
            time: proximoTime,
            posicao: jogador.posicao,
            gols: 0,
            assistencias: 0,
          },
        ]);
      }
      return novo;
    });
  }

  function atualizar(id: number, patch: Partial<ParticipanteForm>) {
    setParticipantes((ps) =>
      ps.map((p) => (p.jogador.id === id ? { ...p, ...patch } : p)),
    );
  }

  const podeSalvar =
    selecionados.size === 16 &&
    contagemTime.a === 8 &&
    contagemTime.b === 8 &&
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
    <div className="p-4 pb-24 space-y-5 max-w-2xl mx-auto">
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

      {/* Seleção de jogadores */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Jogadores
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {selecionados.size}/16 selecionados
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {jogadores.map((j) => {
            const on = selecionados.has(j.id);
            return (
              <button
                key={j.id}
                onClick={() => toggleSelecao(j.id)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                  on
                    ? "border-[var(--cor-destaque)] bg-[var(--cor-destaque)]/10 text-neutral-900 dark:text-neutral-100"
                    : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span className="block">{j.nome}</span>
                <span className="text-[10px] uppercase">
                  {POSICOES[j.posicao]}
                </span>
              </button>
            );
          })}
        </div>
        {jogadores.length < 16 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Aviso: há apenas {jogadores.length} jogadores ativos. Uma partida
            precisa de 16.
          </p>
        )}
      </div>

      {/* Times + gols/assists */}
      {participantes.length > 0 && (
        <div className="space-y-4">
          {(["a", "b"] as TimeId[]).map((t) => (
            <div
              key={t}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              <div
                className="px-3 py-2 text-xs font-semibold flex items-center justify-between"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === "a" ? "#f9fafb" : "#111827",
                }}
              >
                <span>{TIMES[t].nome}</span>
                <span>{contagemTime[t]}/8</span>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {participantes
                  .filter((p) => p.time === t)
                  .map((p) => (
                    <div key={p.jogador.id} className="px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {p.jogador.nome}
                        </span>
                        <select
                          value={p.posicao}
                          onChange={(e) =>
                            atualizar(p.jogador.id, {
                              posicao: e.target.value as PosicaoId,
                            })
                          }
                          className="text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-neutral-900 dark:text-neutral-100"
                        >
                          {(Object.keys(POSICAO_LABEL) as PosicaoId[]).map(
                            (pos) => (
                              <option key={pos} value={pos}>
                                {POSICAO_LABEL[pos]}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <label className="flex items-center gap-1">
                          <span className="text-neutral-500">Gols</span>
                          <input
                            type="number"
                            min={0}
                            value={p.gols}
                            onChange={(e) =>
                              atualizar(p.jogador.id, {
                                gols: Math.max(
                                  0,
                                  parseInt(e.target.value) || 0,
                                ),
                              })
                            }
                            className="w-14 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-neutral-900 dark:text-neutral-100"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          <span className="text-neutral-500">Assists</span>
                          <input
                            type="number"
                            min={0}
                            value={p.assistencias}
                            onChange={(e) =>
                              atualizar(p.jogador.id, {
                                assistencias: Math.max(
                                  0,
                                  parseInt(e.target.value) || 0,
                                ),
                              })
                            }
                            className="w-14 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-neutral-900 dark:text-neutral-100"
                          />
                        </label>
                        <button
                          onClick={() =>
                            atualizar(p.jogador.id, {
                              time: p.time === "a" ? "b" : "a",
                            })
                          }
                          className="ml-auto text-[10px] text-[var(--cor-destaque)] underline"
                        >
                          trocar time
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      {feedback && (
        <p className="text-sm text-green-600 dark:text-green-400">{feedback}</p>
      )}

      <div className="fixed bottom-16 left-0 right-0 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 max-w-2xl mx-auto">
        <button
          onClick={salvarComoDraft}
          disabled={!podeSalvar}
          className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar rascunho"}
        </button>
        {!podeSalvar && selecionados.size > 0 && (
          <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Precisa de 16 jogadores (8 por time).
          </p>
        )}
      </div>
    </div>
  );
}
