import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Wand2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { type TimeId } from "../lib/times";
import { formatarDataCompleta } from "../lib/formatacao";
import { MensagemEstado } from "../components/Estado";
import {
  gerarEscalacaoAutomatica,
  type ParticipanteForm,
} from "../lib/escalacao";

interface EstadoPartida {
  selecionados: number[];
  jogadores: JogadorLista[];
  dataJogo: string;
  horaJogo?: string;
}

const LIMITE_POR_TIME = 8;
const STORAGE_KEY = "racha_nova_partida";

export function PartidaNovaTimes() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = location.state as EstadoPartida | null;

  // Hooks sempre chamados antes de qualquer return condicional (Regra dos Hooks).
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([]);
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    obterMediasNotasJogadores()
      .then(setMediasNotas)
      .catch(() => {
        // Falha silenciosa: assume nota 6.0 padrao se falhar busca
      });
  }, []);

  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const p of participantes) c[p.time]++;
    return c;
  }, [participantes]);

  // Goleiros escalados por time. Regra: cada time pode ter no máximo 1 goleiro
  // (com 2 goleiros no total e 8 por time, o único estado válido é 1 em cada).
  const contagemGoleiros = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const p of participantes)
      if (p.posicao === "goleiro") c[p.time]++;
    return c;
  }, [participantes]);

  // Guard admin.
  if (!isAdmin) return <Navigate to="/" replace />;

  // Guard de state ausente (acesso direto/refresh): volta para a Etapa 1.
  if (
    !estado ||
    !Array.isArray(estado.selecionados) ||
    !Array.isArray(estado.jogadores)
  ) {
    return <Navigate to="/partida/nova" replace />;
  }

  const horaJogo = estado.horaJogo || "19:00";
  const { dataJogo } = estado;

  // Apenas os 16 confirmados recebidos via state.
  const jogadoresConfirmados = estado.jogadores.filter((j) =>
    estado.selecionados.includes(j.id),
  );

  const mediasPorTime = useMemo(() => {
    const res: Record<TimeId, number> = { a: 0, b: 0 };
    for (const t of ["a", "b"] as TimeId[]) {
      const parts = participantes.filter((p) => p.time === t);
      if (parts.length === 0) {
        res[t] = 0;
      } else {
        const soma = parts.reduce((acc, p) => {
          const n = p.media_nota ?? mediasNotas[p.jogador.id] ?? 6.0;
          return acc + n;
        }, 0);
        res[t] = Number((soma / parts.length).toFixed(1));
      }
    }
    return res;
  }, [participantes, mediasNotas]);

  function timeDoJogador(id: number): TimeId | null {
    return participantes.find((p) => p.jogador.id === id)?.time ?? null;
  }

  function autoEscalar() {
    setErro(null);
    const proposta = gerarEscalacaoAutomatica(jogadoresConfirmados, mediasNotas);
    setParticipantes(proposta);
    const timeAPart = proposta.filter((p) => p.time === "a");
    const timeBPart = proposta.filter((p) => p.time === "b");
    const avgA = timeAPart.length
      ? (timeAPart.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / timeAPart.length).toFixed(1)
      : "0.0";
    const avgB = timeBPart.length
      ? (timeBPart.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / timeBPart.length).toFixed(1)
      : "0.0";
    setFeedback(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
  }

  function atribuirTime(id: number, time: TimeId) {
    setFeedback(null);
    const atual = participantes.find((p) => p.jogador.id === id) ?? null;
    const jogador = jogadoresConfirmados.find((j) => j.id === id)!;
    const ehGoleiro = jogador.posicao === "goleiro";

    // Já está nesse time -> remove (não joga)
    if (atual && atual.time === time) {
      setParticipantes((prev) => prev.filter((p) => p.jogador.id !== id));
      return;
    }

    // Regra: cada time pode ter no máximo 1 goleiro. Bloqueia mover/adicionar
    // um goleiro a um time que já tem outro goleiro.
    const destinoTemGoleiro = participantes.some(
      (p) => p.time === time && p.posicao === "goleiro" && p.jogador.id !== id,
    );
    if (ehGoleiro && destinoTemGoleiro) {
      setFeedback(
        `Cada time só pode ter 1 goleiro. ${jogador.nome} não pode ir para o ${time === "a" ? "Preto" : "Branco"}.`,
      );
      return;
    }

    // Bloqueia se o time alvo já está cheio.
    const destinoCheio =
      participantes.filter((p) => p.time === time).length >= LIMITE_POR_TIME;
    if (destinoCheio) return;

    setParticipantes((prev) => {
      // Não está em time -> adiciona
      if (!atual) {
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
      }
      // Está no outro time -> troca
      return prev.map((p) => (p.jogador.id === id ? { ...p, time } : p));
    });
  }

  const podeSalvar =
    contagemTime.a === LIMITE_POR_TIME &&
    contagemTime.b === LIMITE_POR_TIME &&
    contagemGoleiros.a === 1 &&
    contagemGoleiros.b === 1 &&
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

    // Limpa o rascunho persistido da Etapa 1.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage indisponível — ignora silenciosamente.
    }

    setFeedback(`Partida #${data} criada.`);
    setTimeout(() => navigate(`/partida/${data}`, { replace: true }), 800);
  }

  // Data/hora para o resumo (mesmo padrão do PartidaConfirma).
  const dataHoraIso =
    dataJogo && horaJogo ? `${dataJogo}T${horaJogo}` : dataJogo;
  const dataHoraTexto = dataHoraIso
    ? formatarDataCompleta(dataHoraIso)
    : `${dataJogo} · ${horaJogo}`;

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-neutral-500 dark:text-neutral-400 mb-2"
        >
          ← voltar
        </button>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Escolher times
          </h2>
          <button
            type="button"
            onClick={autoEscalar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition shrink-0"
            title="Gera uma proposta equilibrada de divisão dos times usando as posições A e B"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Gerar automaticamente</span>
          </button>
        </div>
      </div>

      {/* Resumo: data/hora */}
      {dataHoraTexto && (
        <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
            {dataHoraTexto}
          </p>
        </section>
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
            Jogadores
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Toque em Preto ou Branco para escalar
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden">
          {jogadoresConfirmados.map((j) => {
            const time = timeDoJogador(j.id);
            const neutro = time === null;
            const ehGoleiro = j.posicao === "goleiro";
            const pretoCheio = contagemTime.a >= LIMITE_POR_TIME && time !== "a";
            const brancoCheio =
              contagemTime.b >= LIMITE_POR_TIME && time !== "b";
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
            onClick={salvarComoDraft}
            disabled={!podeSalvar}
            className="w-full min-h-[44px] rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition"
          >
            {salvando ? "Criando…" : "Criar partida"}
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
