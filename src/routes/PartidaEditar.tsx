import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import { TIMES, type TimeId } from "../lib/times";
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
  type Participante,
} from "../lib/partidas";
import { Carregando, MensagemEstado } from "../components/Estado";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";

interface Stats {
  gols: number;
  assistencias: number;
  gols_contra: number;
}

export function PartidaEditar() {
  const isAdmin = useAdmin();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!partidaId) return;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
    ])
      .then(([p, parts]) => {
        setPartida(p);
        setParticipantes(parts);
        const inicial: Record<number, Stats> = {};
        for (const part of parts) {
          inicial[part.jogador_id] = {
            gols: part.gols,
            assistencias: part.assistencias,
            gols_contra: part.gols_contra,
          };
        }
        setStats(inicial);
      })
      .catch((e) => setErro(e.message ?? String(e)))
      .finally(() => setCarregando(false));
  }, [partidaId]);

  const participantesPorTime = useMemo(() => {
    const map: Record<TimeId, Participante[]> = { a: [], b: [] };
    for (const p of participantes) map[p.time].push(p);
    for (const t of ["a", "b"] as TimeId[]) {
      map[t].sort((a, b) =>
        (a.nome ?? "").localeCompare(b.nome ?? ""),
      );
    }
    return map;
  }, [participantes]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Erro: {erro}
      </MensagemEstado>
    );
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );

  // Em closed, não editável
  const bloqueado = partida.status === "closed";
  const primeiraVez = partida.status === "draft";

  function ajustar(jogadorId: number, campo: keyof Stats, delta: number) {
    setStats((prev) => {
      const atual = prev[jogadorId] ?? {
        gols: 0,
        assistencias: 0,
        gols_contra: 0,
      };
      return {
        ...prev,
        [jogadorId]: {
          ...atual,
          [campo]: Math.max(0, atual[campo] + delta),
        },
      };
    });
  }

  async function salvar() {
    setConfirmando(false);
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    try {
      const updates = participantes.map((p) =>
        supabase
          .from("partidas_participantes")
          .update({
            gols: stats[p.jogador_id]?.gols ?? 0,
            assistencias: stats[p.jogador_id]?.assistencias ?? 0,
            gols_contra: stats[p.jogador_id]?.gols_contra ?? 0,
          })
          .eq("partida_id", partidaId)
          .eq("jogador_id", p.jogador_id),
      );
      const resultados = await Promise.all(updates);
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw falha.error;

      // Transição de status: draft -> published (abre votação 24h)
      if (primeiraVez) {
        const votingClosesAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString();
        const { error: errStatus } = await supabase
          .from("partidas")
          .update({ status: "published", voting_closes_at: votingClosesAt })
          .eq("id", partidaId);
        if (errStatus) throw errStatus;
      }

      setFeedback("Resultado salvo.");
      setTimeout(() => {
        window.location.href = `/partida/${partidaId}`;
      }, 700);
    } catch (e: any) {
      setErro("Erro ao salvar resultado: " + (e?.message ?? String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 max-w-2xl mx-auto space-y-4">
      <Link
        to={`/partida/${partidaId}`}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </Link>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {primeiraVez ? "Botar o resultado" : "Editar resultado"} · Partida #
          {partidaId}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
          <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
          <span className="hidden sm:inline">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </p>
      </div>

      {bloqueado && (
        <MensagemEstado tipo="info">
          Partida encerrada — resultado não pode ser editado.
        </MensagemEstado>
      )}

      {/* Times + steppers por jogador */}
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
              <span>{participantesPorTime[t].length}/8</span>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {participantesPorTime[t].map((p) => {
                const s = stats[p.jogador_id] ?? {
                  gols: 0,
                  assistencias: 0,
                  gols_contra: 0,
                };
                return (
                  <div
                    key={p.jogador_id}
                    className="px-3 py-2 flex items-center gap-2"
                  >
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {p.nome ?? `#${p.jogador_id}`}
                    </span>
                    <div className="shrink-0 flex items-center gap-2">
                      <Stepper
                        label="⚽"
                        title="Gol"
                        valor={s.gols}
                        tom="destaque"
                        disabled={bloqueado}
                        onMais={() => ajustar(p.jogador_id, "gols", 1)}
                        onMenos={() => ajustar(p.jogador_id, "gols", -1)}
                      />
                      <Stepper
                        label="🅰️"
                        title="Assistência"
                        valor={s.assistencias}
                        tom="neutro"
                        disabled={bloqueado}
                        onMais={() =>
                          ajustar(p.jogador_id, "assistencias", 1)
                        }
                        onMenos={() =>
                          ajustar(p.jogador_id, "assistencias", -1)
                        }
                      />
                      <Stepper
                        label="GC"
                        title="Gols contra"
                        valor={s.gols_contra}
                        tom="perigo"
                        disabled={bloqueado}
                        onMais={() =>
                          ajustar(p.jogador_id, "gols_contra", 1)
                        }
                        onMenos={() =>
                          ajustar(p.jogador_id, "gols_contra", -1)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      {!bloqueado && (
        <div
          className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setConfirmando(true)}
              disabled={salvando}
              className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition"
            >
              {salvando
                ? "Salvando…"
                : primeiraVez
                  ? "Publicar resultado"
                  : "Salvar alterações"}
            </button>
            {primeiraVez && (
              <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Publica o placar e abre a votação por 24h.
              </p>
            )}
            {!primeiraVez && (
              <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Votos já registrados serão mantidos.
              </p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={salvar}
        titulo={primeiraVez ? "Publicar resultado?" : "Salvar alterações?"}
        mensagem={
          primeiraVez
            ? "Isso publica o placar e abre a votação por 24h."
            : "Votos já registrados serão mantidos."
        }
        textoConfirmar={primeiraVez ? "Publicar" : "Salvar"}
      />
    </div>
  );
}

function Stepper({
  label,
  title,
  valor,
  tom,
  disabled,
  onMais,
  onMenos,
}: {
  label: string;
  title: string;
  valor: number;
  tom: "destaque" | "neutro" | "perigo";
  disabled?: boolean;
  onMais: () => void;
  onMenos: () => void;
}) {
  const cor =
    tom === "perigo"
      ? "text-red-600 dark:text-red-400"
      : tom === "destaque"
        ? "text-[var(--cor-destaque)]"
        : "text-neutral-500 dark:text-neutral-400";
  return (
    <div
      className="flex flex-col items-center"
      title={`${title}: ${valor}`}
    >
      <span className={`text-[10px] font-semibold leading-none ${cor}`}>
        {label}
      </span>
      <div className="flex items-center gap-0.5 mt-0.5">
        <button
          type="button"
          onClick={onMenos}
          disabled={disabled || valor === 0}
          aria-label={`Diminuir ${title}`}
          className="min-h-[36px] min-w-[28px] rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs disabled:opacity-30 active:scale-95 transition"
        >
          −
        </button>
        <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {valor}
        </span>
        <button
          type="button"
          onClick={onMais}
          disabled={disabled}
          aria-label={`Aumentar ${title}`}
          className={`min-h-[36px] min-w-[28px] rounded-md border text-xs font-bold active:scale-95 transition disabled:opacity-30 ${
            tom === "perigo"
              ? "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
              : tom === "destaque"
                ? "border-[var(--cor-destaque)] text-[var(--cor-destaque)]"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}
