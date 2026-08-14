import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2 } from "lucide-react";
import {
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { gerarEscalacaoAutomatica } from "../lib/escalacao";
import { type TimeId } from "../lib/times";
import { MensagemEstado } from "./Estado";

export const LIMITE_POR_TIME = 8;

export interface EscalacaoTimesEditorProps {
  jogadores: JogadorLista[];
  times: Record<number, TimeId>;
  onTimesChange: (times: Record<number, TimeId>) => void;
  onSalvar: () => void | Promise<void>;
  mediasNotas?: Record<number, number>;
  salvando?: boolean;
  salvarRotulo?: string;
  salvandoRotulo?: string;
  podeSalvarExtra?: boolean;
  titulo?: React.ReactNode;
  subtitulo?: React.ReactNode;
  linkVoltar?: string;
  onVoltar?: () => void;
  rotuloListaJogadores?: string;
  infoExtra?: React.ReactNode;
  erro?: string | null;
  onLimparErro?: () => void;
  feedbackExterno?: string | null;
}

export function EscalacaoTimesEditor({
  jogadores,
  times,
  onTimesChange,
  onSalvar,
  mediasNotas: mediasNotasProp,
  salvando = false,
  salvarRotulo = "Salvar times",
  salvandoRotulo = "Salvando…",
  podeSalvarExtra,
  titulo = "Escalar times",
  subtitulo,
  linkVoltar,
  onVoltar,
  rotuloListaJogadores = "Jogadores",
  infoExtra,
  erro,
  onLimparErro,
  feedbackExterno,
}: EscalacaoTimesEditorProps) {
  const [mediasInternas, setMediasInternas] = useState<Record<number, number>>({});
  const [feedbackInterno, setFeedbackInterno] = useState<string | null>(null);

  useEffect(() => {
    if (mediasNotasProp) return;
    obterMediasNotasJogadores()
      .then(setMediasInternas)
      .catch(() => {
        // Falha silenciosa: assume nota 6.0 padrão se falhar busca
      });
  }, [mediasNotasProp]);

  const mediasNotas = mediasNotasProp ?? mediasInternas;
  const feedback = feedbackExterno ?? feedbackInterno;

  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const jid in times) {
      if (times[jid]) c[times[jid]]++;
    }
    return c;
  }, [times]);

  const contagemGoleiros = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const jid in times) {
      const j = jogadores.find((x) => x.id === Number(jid));
      if (j?.posicao === "goleiro" && times[jid]) c[times[jid]]++;
    }
    return c;
  }, [times, jogadores]);

  const mediasPorTime = useMemo(() => {
    const res: Record<TimeId, number> = { a: 0, b: 0 };
    for (const t of ["a", "b"] as TimeId[]) {
      const ids = Object.entries(times)
        .filter(([, tm]) => tm === t)
        .map(([jid]) => Number(jid));
      if (ids.length === 0) {
        res[t] = 0;
      } else {
        const soma = ids.reduce((acc, jid) => acc + (mediasNotas[jid] ?? 6.0), 0);
        res[t] = Number((soma / ids.length).toFixed(1));
      }
    }
    return res;
  }, [times, mediasNotas]);

  function autoEscalar() {
    if (onLimparErro) onLimparErro();
    setFeedbackInterno(null);

    if (jogadores.length < LIMITE_POR_TIME * 2) {
      setFeedbackInterno(
        `Precisa de ${LIMITE_POR_TIME * 2} confirmados para gerar os times automaticamente.`,
      );
      return;
    }

    const proposta = gerarEscalacaoAutomatica(jogadores, mediasNotas);
    const novos: Record<number, TimeId> = {};
    for (const p of proposta) {
      novos[p.jogador.id] = p.time;
    }
    onTimesChange(novos);

    const timeAPart = proposta.filter((p) => p.time === "a");
    const timeBPart = proposta.filter((p) => p.time === "b");
    const avgA = timeAPart.length
      ? (
          timeAPart.reduce(
            (s, p) => s + (p.media_nota ?? mediasNotas[p.jogador.id] ?? 6.0),
            0,
          ) / timeAPart.length
        ).toFixed(1)
      : "0.0";
    const avgB = timeBPart.length
      ? (
          timeBPart.reduce(
            (s, p) => s + (p.media_nota ?? mediasNotas[p.jogador.id] ?? 6.0),
            0,
          ) / timeBPart.length
        ).toFixed(1)
      : "0.0";
    setFeedbackInterno(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
  }

  function atribuirTime(id: number, time: TimeId) {
    setFeedbackInterno(null);
    const jogador = jogadores.find((j) => j.id === id);
    const ehGoleiro = jogador?.posicao === "goleiro";
    const atual = times[id] ?? null;

    // Já está nesse time -> remove (sem time)
    if (atual && atual === time) {
      const novos = { ...times };
      delete novos[id];
      onTimesChange(novos);
      return;
    }

    // Regra: cada time pode ter no máximo 1 goleiro. Bloqueia mover/adicionar
    // um goleiro a um time que já tem outro goleiro.
    const destinoTemGoleiro = Object.entries(times).some(
      ([jid, tm]) =>
        tm === time &&
        Number(jid) !== id &&
        jogadores.find((x) => x.id === Number(jid))?.posicao === "goleiro",
    );
    if (ehGoleiro && destinoTemGoleiro) {
      setFeedbackInterno(
        `Cada time só pode ter 1 goleiro. ${jogador?.nome ?? ""} não pode ir para o ${
          time === "a" ? "Preto" : "Branco"
        }.`,
      );
      return;
    }

    // Bloqueia se o time alvo já está cheio.
    const destinoCheio =
      Object.values(times).filter((tm) => tm === time).length >= LIMITE_POR_TIME;
    if (destinoCheio) return;

    onTimesChange({ ...times, [id]: time });
  }

  const podeSalvar =
    contagemTime.a === LIMITE_POR_TIME &&
    contagemTime.b === LIMITE_POR_TIME &&
    contagemGoleiros.a === 1 &&
    contagemGoleiros.b === 1 &&
    !salvando &&
    (podeSalvarExtra !== undefined ? podeSalvarExtra : true);

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        {linkVoltar ? (
          <Link
            to={linkVoltar}
            className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 inline-block"
          >
            ← voltar
          </Link>
        ) : onVoltar ? (
          <button
            type="button"
            onClick={onVoltar}
            className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 inline-block cursor-pointer"
          >
            ← voltar
          </button>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={autoEscalar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition shrink-0 cursor-pointer"
            title="Gera uma proposta equilibrada de divisão dos times usando as posições A e B"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Gerar automaticamente</span>
          </button>
        </div>
        {subtitulo}
      </div>

      {infoExtra}

      {/* Contagem por time */}
      <div className="flex gap-3">
        {(["a", "b"] as TimeId[]).map((t) => {
          const qtd = contagemTime[t];
          const cheio = qtd >= LIMITE_POR_TIME;
          const rotulo = t === "a" ? "Preto" : "Branco";
          const media = mediasPorTime[t];
          return (
            <div
              key={t}
              className={`flex-1 rounded-lg border px-3 py-2 flex items-center justify-between transition ${
                cheio
                  ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{rotulo}</span>
                {qtd > 0 && (
                  <>
                    <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      Média {media}★
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      🧤 {contagemGoleiros[t]}/1
                    </span>
                  </>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {cheio ? "✓ " : ""}
                {qtd}/{LIMITE_POR_TIME}
              </span>
            </div>
          );
        })}
      </div>

      {/* Lista dos confirmados com botões Preto/Branco */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {rotuloListaJogadores}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Toque em Preto ou Branco para escalar
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden">
          {jogadores.map((j) => {
            const time = times[j.id] ?? null;
            const neutro = time === null;
            const ehGoleiro = j.posicao === "goleiro";
            const pretoCheio = contagemTime.a >= LIMITE_POR_TIME && time !== "a";
            const brancoCheio = contagemTime.b >= LIMITE_POR_TIME && time !== "b";
            // Goleiro não pode entrar num time que já tem outro goleiro.
            const pretoBloqueiaGoleiro =
              ehGoleiro && time !== "a" && contagemGoleiros.a >= 1;
            const brancoBloqueiaGoleiro =
              ehGoleiro && time !== "b" && contagemGoleiros.b >= 1;
            const pretoDisabled = pretoCheio || pretoBloqueiaGoleiro;
            const brancoDisabled = brancoCheio || brancoBloqueiaGoleiro;
            const temNota = mediasNotas[j.id] !== undefined;
            const notaJogador = temNota ? mediasNotas[j.id] : 6.0;

            return (
              <div
                key={j.id}
                className={`flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 ${
                  neutro ? "opacity-60" : ""
                }`}
              >
                <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {j.nome}
                  </span>
                  {ehGoleiro && (
                    <span
                      className="shrink-0 text-[11px]"
                      title="Goleiro — cada time só pode ter 1"
                    >
                      🧤
                    </span>
                  )}
                  <span
                    className={`shrink-0 text-[11px] font-medium font-mono ${
                      temNota
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-neutral-400 dark:text-neutral-500"
                    }`}
                    title={
                      temNota
                        ? `Média dos votos: ${notaJogador.toFixed(1)}★`
                        : "Sem votos registrados (nota padrão 6.0★)"
                    }
                  >
                    {notaJogador.toFixed(1)}★
                  </span>
                </div>
                <div className="shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => atribuirTime(j.id, "a")}
                    disabled={pretoDisabled}
                    aria-pressed={time === "a"}
                    aria-label={`Escalar ${j.nome} no time Preto`}
                    title={
                      pretoBloqueiaGoleiro
                        ? "O time Preto já tem um goleiro"
                        : undefined
                    }
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-lg border text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
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
                    disabled={brancoDisabled}
                    aria-pressed={time === "b"}
                    aria-label={`Escalar ${j.nome} no time Branco`}
                    title={
                      brancoBloqueiaGoleiro
                        ? "O time Branco já tem um goleiro"
                        : undefined
                    }
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-lg border text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
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
          {jogadores.length === 0 && (
            <div className="px-3 py-3 text-xs text-neutral-400">
              Nenhum confirmado ainda.
            </div>
          )}
        </div>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      <div
        className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={onSalvar}
            disabled={!podeSalvar}
            className="w-full min-h-[44px] rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition cursor-pointer"
          >
            {salvando ? salvandoRotulo : salvarRotulo}
          </button>
          {!podeSalvar && (
            <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              {contagemTime.a !== LIMITE_POR_TIME ||
              contagemTime.b !== LIMITE_POR_TIME
                ? `Aloque ${LIMITE_POR_TIME} jogadores em cada time.`
                : "Cada time precisa ter exatamente 1 goleiro."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
