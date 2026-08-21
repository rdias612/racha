import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Wand2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
  type Participante,
} from "../lib/partidas";
import {
  listarJogadoresAtivos,
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { gerarEscalacaoAutomatica } from "../lib/escalacao";
import { type TimeId } from "../lib/times";
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";
import { Carregando, MensagemEstado } from "../components/Estado";

const LIMITE_POR_TIME = 8;

// Escalar/dividir os times de um draft JÁ EXISTENTE (partida automática semanal
// ou rascunho manual). Diferente do PartidaNovaTimes (que é etapa de criação),
// aqui os participantes vêm do DB e o salvamento é um UPDATE do `time` de cada
// um. Só entram na escalação os `confirmado` (o elenco que vai jogar).
export function PartidaTimes() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [times, setTimes] = useState<Record<number, TimeId>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!partidaId) return;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
      obterMediasNotasJogadores(),
    ])
      .then(([p, parts, ativos, medias]) => {
        setPartida(p);
        setParticipantes(parts);
        setJogadoresAtivos(ativos);
        setMediasNotas(medias);
        // Pré-carrega o time atual de cada confirmado.
        const init: Record<number, TimeId> = {};
        for (const part of parts) {
          if (part.status_confirmacao === "confirmado" && part.time) {
            init[part.jogador_id] = part.time;
          }
        }
        setTimes(init);
      })
      .catch((e) => setErro(e.message ?? String(e)))
      .finally(() => setCarregando(false));
  }, [partidaId]);

  // Só os confirmados entram na escalação.
  const confirmadosIds = useMemo(
    () =>
      new Set(
        participantes
          .filter((p) => p.status_confirmacao === "confirmado")
          .map((p) => p.jogador_id),
      ),
    [participantes],
  );

  const confirmadosJogadores = useMemo(
    () =>
      jogadoresAtivos
        .filter((j) => confirmadosIds.has(j.id))
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [jogadoresAtivos, confirmadosIds],
  );

  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const time of Object.values(times)) {
      if (time) c[time]++;
    }
    return c;
  }, [times]);

  const contagemGoleiros = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const [jid, time] of Object.entries(times)) {
      const j = confirmadosJogadores.find((x) => x.id === Number(jid));
      if (j?.posicao === "goleiro" && time) c[time]++;
    }
    return c;
  }, [times, confirmadosJogadores]);

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

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );
  if (partida.status !== "draft")
    return <Navigate to={`/partida/${partidaId}`} replace />;

  function atribuirTime(id: number, time: TimeId) {
    setFeedback(null);
    const jogador = confirmadosJogadores.find((j) => j.id === id);
    const ehGoleiro = jogador?.posicao === "goleiro";
    const atual = times[id];

    // Já está nesse time -> remove (sem time).
    if (atual && atual === time) {
      setTimes((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      return;
    }

    // Goleiro não pode entrar num time que já tem outro goleiro.
    const destinoTemGoleiro = Object.entries(times).some(
      ([jid, tm]) =>
        tm === time &&
        Number(jid) !== id &&
        confirmadosJogadores.find((x) => x.id === Number(jid))?.posicao ===
          "goleiro",
    );
    if (ehGoleiro && destinoTemGoleiro) {
      setFeedback(
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

    setTimes((prev) => ({ ...prev, [id]: time }));
  }

  function autoEscalar() {
    setErro(null);
    setFeedback(null);
    if (confirmadosJogadores.length < LIMITE_POR_TIME * 2) {
      setFeedback(
        `Precisa de ${LIMITE_POR_TIME * 2} confirmados para gerar os times automaticamente.`,
      );
      return;
    }
    const proposta = gerarEscalacaoAutomatica(confirmadosJogadores, mediasNotas);
    const novos: Record<number, TimeId> = {};
    for (const p of proposta) novos[p.jogador.id] = p.time;
    setTimes(novos);
    const a = proposta.filter((p) => p.time === "a");
    const b = proposta.filter((p) => p.time === "b");
    const avgA = a.length
      ? (a.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / a.length).toFixed(1)
      : "0.0";
    const avgB = b.length
      ? (b.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / b.length).toFixed(1)
      : "0.0";
    setFeedback(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
  }

  const podeSalvar =
    contagemTime.a === LIMITE_POR_TIME &&
    contagemTime.b === LIMITE_POR_TIME &&
    contagemGoleiros.a === 1 &&
    contagemGoleiros.b === 1 &&
    !salvando;

  const faltamConfirmados =
    confirmadosJogadores.length < LIMITE_POR_TIME * 2
      ? LIMITE_POR_TIME * 2 - confirmadosJogadores.length
      : 0;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setFeedback(null);
    try {
      // Atualiza o time de todos os participantes: confirmado -> time escalado,
      // os demais -> NULL (não jogam). `abrir_partida` valida só confirmados.
      const updates = participantes.map((p) => {
        const novoTime =
          p.status_confirmacao === "confirmado" && times[p.jogador_id]
            ? times[p.jogador_id]
            : null;
        return supabase
          .from("partidas_participantes")
          .update({ time: novoTime })
          .eq("partida_id", partidaId)
          .eq("jogador_id", p.jogador_id);
      });
      const resultados = await Promise.all(updates);
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw falha.error;
      setFeedback("Times salvos.");
      setTimeout(() => navigate(`/partida/${partidaId}`, { replace: true }), 600);
    } catch (e) {
      setErro("Erro ao salvar times: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <Link
          to={`/partida/${partidaId}`}
          className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 inline-block"
        >
          ← voltar
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Escalar times · Partida #{partidaId}
          </h2>
          <button
            type="button"
            onClick={autoEscalar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition shrink-0"
            title="Gera uma proposta equilibrada de divisão dos times"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Gerar automaticamente</span>
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize mt-1">
          <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
          <span className="hidden sm:inline">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </p>
      </div>

      {faltamConfirmados > 0 && (
        <MensagemEstado tipo="info">
          {confirmadosJogadores.length} confirmados — faltam {faltamConfirmados}{" "}
          para completar {LIMITE_POR_TIME * 2}. Adicione avulsos na partida para
          liberar a escalação completa.
        </MensagemEstado>
      )}

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
            Confirmados ({confirmadosJogadores.length})
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Toque em Preto ou Branco para escalar
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden">
          {confirmadosJogadores.map((j) => {
            const time = times[j.id] ?? null;
            const neutro = time === null;
            const ehGoleiro = j.posicao === "goleiro";
            const pretoCheio = contagemTime.a >= LIMITE_POR_TIME && time !== "a";
            const brancoCheio = contagemTime.b >= LIMITE_POR_TIME && time !== "b";
            const pretoBloqueiaGoleiro =
              ehGoleiro && time !== "a" && contagemGoleiros.a >= 1;
            const brancoBloqueiaGoleiro =
              ehGoleiro && time !== "b" && contagemGoleiros.b >= 1;
            const pretoDisabled = pretoCheio || pretoBloqueiaGoleiro;
            const brancoDisabled = brancoCheio || brancoBloqueiaGoleiro;
            const notaJogador = mediasNotas[j.id] ?? 6.0;
            const temNota = mediasNotas[j.id] !== undefined;

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
                    disabled={brancoDisabled}
                    aria-pressed={time === "b"}
                    aria-label={`Escalar ${j.nome} no time Branco`}
                    title={
                      brancoBloqueiaGoleiro
                        ? "O time Branco já tem um goleiro"
                        : undefined
                    }
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
          {confirmadosJogadores.length === 0 && (
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
            onClick={salvar}
            disabled={!podeSalvar}
            className="w-full min-h-[44px] rounded-lg bg-destaque px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition"
          >
            {salvando ? "Salvando…" : "Salvar times"}
          </button>
          {!podeSalvar && (
            <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              {contagemTime.a !== LIMITE_POR_TIME ||
              contagemTime.b !== LIMITE_POR_TIME
                ? "Aloque 8 jogadores em cada time."
                : "Cada time precisa ter exatamente 1 goleiro."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
