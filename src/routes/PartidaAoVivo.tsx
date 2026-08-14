import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CampoPartida } from "../components/CampoPartida";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DialogoEvento } from "../components/DialogoEvento";
import { Carregando, MensagemEstado } from "../components/Estado";
import { useAdmin } from "../hooks/useAdmin";
import { formatarDataMobile, formatarNome } from "../lib/formatacao";
import { tocarApito } from "../lib/audio";
import { vibrateWhistle } from "../lib/haptics";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Volume2,
  Timer,
} from "lucide-react";
import {
  abrirPartida,
  carregarEventos,
  carregarParticipantes,
  carregarPartida,
  finalizarPartida,
  placarDeEventos,
  editarEvento,
  registrarEvento,
  removerEvento,
  STATUS_COR,
  STATUS_LABEL,
  type EventoPartida,
  type Participante,
  type Partida,
  type TipoEvento,
} from "../lib/partidas";

function nomeDoJogador(
  participantes: Participante[],
  jogadorId: number | null,
): string {
  if (jogadorId == null) return "";
  const nome =
    participantes.find((p) => p.jogador_id === jogadorId)?.nome ??
    `#${jogadorId}`;
  return formatarNome(nome);
}

export function PartidaAoVivo() {
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);
  const navigate = useNavigate();
  const isAdmin = useAdmin();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [eventos, setEventos] = useState<EventoPartida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Participante | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [eventoParaRemover, setEventoParaRemover] =
    useState<EventoPartida | null>(null);
  const [eventoEmEdicao, setEventoEmEdicao] = useState<EventoPartida | null>(
    null,
  );

  // Cronômetro Integrado com persistência local
  const CRONOMETRO_STORAGE_KEY = `racha_cronometro_${partidaId}`;

  const [cronometroSegundos, setCronometroSegundos] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`racha_cronometro_${partidaId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rodando && parsed.ultimoTimestamp) {
          const delta = Math.floor((Date.now() - parsed.ultimoTimestamp) / 1000);
          return (parsed.segundos || 0) + delta;
        }
        return parsed.segundos || 0;
      }
    } catch {}
    return 0;
  });

  const [cronometroRodando, setCronometroRodando] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`racha_cronometro_${partidaId}`);
      if (saved) {
        return JSON.parse(saved).rodando ?? false;
      }
    } catch {}
    return false;
  });

  const [acrescimosMinutos, setAcrescimosMinutos] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`racha_cronometro_${partidaId}`);
      if (saved) {
        return JSON.parse(saved).acrescimos || 0;
      }
    } catch {}
    return 0;
  });

  // Salvar estado do cronômetro
  useEffect(() => {
    if (!partidaId) return;
    try {
      localStorage.setItem(
        CRONOMETRO_STORAGE_KEY,
        JSON.stringify({
          segundos: cronometroSegundos,
          rodando: cronometroRodando,
          ultimoTimestamp: Date.now(),
          acrescimos: acrescimosMinutos,
        }),
      );
    } catch {}
  }, [cronometroSegundos, cronometroRodando, acrescimosMinutos, CRONOMETRO_STORAGE_KEY, partidaId]);

  // Tick do cronômetro
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (cronometroRodando) {
      interval = setInterval(() => {
        setCronometroSegundos((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cronometroRodando]);

  // Screen Wake Lock API (Impede a tela de apagar enquanto a partida estiver ao vivo)
  useEffect(() => {
    let wakeLockSentinel: any = null;

    async function requestWakeLock() {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
        } catch (err) {
          console.warn("Wake Lock indisponível:", err);
        }
      }
    }

    if (partida?.status === "live") {
      requestWakeLock();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && partida?.status === "live") {
        requestWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [partida?.status]);

  const recarregar = useCallback(async () => {
    if (!partidaId) return;
    const [p, parts, evs] = await Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      carregarEventos(partidaId),
    ]);
    setPartida(p);
    setParticipantes(parts);
    setEventos(evs);
  }, [partidaId]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    recarregar()
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [recarregar]);

  useEffect(() => {
    if (partida?.status !== "live") return;
    const intervalo = setInterval(() => {
      recarregar().catch(() => {});
    }, 10_000);
    return () => clearInterval(intervalo);
  }, [partida?.status, recarregar]);

  const placar = useMemo(
    () => placarDeEventos(eventos, participantes),
    [eventos, participantes],
  );

  const companheiros = useMemo(() => {
    if (!alvo) return [];
    return participantes
      .filter((p) => p.time === alvo.time && p.jogador_id !== alvo.jogador_id)
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
  }, [alvo, participantes]);

  if (!partidaId) return <Navigate to="/jogos" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (!partida) {
    return (
      <MensagemEstado
        tipo={erro ? "erro" : "info"}
        className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl"
      >
        {erro ?? "Partida não encontrada."}
      </MensagemEstado>
    );
  }

  if (partida.status === "published" || partida.status === "closed") {
    return <Navigate to={`/partida/${partida.id}`} replace />;
  }

  const aoVivo = partida.status === "live";
  const podeRegistrar = isAdmin && aoVivo;

  function handleToggleCronometro() {
    if (!cronometroRodando) {
      tocarApito("inicio");
      setCronometroRodando(true);
    } else {
      tocarApito("curto");
      setCronometroRodando(false);
    }
  }

  function handleResetCronometro() {
    if (cronometroSegundos > 0) {
      if (!window.confirm("Deseja zerar o cronômetro da partida?")) return;
    }
    setCronometroRodando(false);
    setCronometroSegundos(0);
    setAcrescimosMinutos(0);
    tocarApito("duplo");
  }

  function handleAdicionarAcrescimo(min: number) {
    setAcrescimosMinutos((prev) => prev + min);
    tocarApito("curto");
  }

  function formatarCronometro(totalSegundos: number) {
    const mins = Math.floor(totalSegundos / 60);
    const segs = totalSegundos % 60;
    return `${String(mins).padStart(2, "0")}:${String(segs).padStart(2, "0")}`;
  }

  async function confirmarAbrir() {
    if (!partida) return;
    setAbrindo(true);
    setErro(null);
    try {
      const ok = await abrirPartida(partida.id);
      if (!ok) {
        setErro(
          "Não foi possível abrir. Confira se os dois times têm 8 jogadores e 1 goleiro cada.",
        );
        return;
      }
      tocarApito("inicio");
      vibrateWhistle();
      setCronometroRodando(true);
      await recarregar();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAbrindo(false);
    }
  }

  function abrirEdicao(evento: EventoPartida) {
    const jogador = participantes.find(
      (p) => p.jogador_id === evento.jogador_id,
    );
    if (!jogador) return;
    setEventoEmEdicao(evento);
    setAlvo(jogador);
  }

  async function confirmarEvento(
    tipo: TipoEvento,
    assistenciaId: number | null,
  ) {
    if (!partida || !alvo) return;
    setSalvando(true);
    setErro(null);
    try {
      if (eventoEmEdicao) {
        const ok = await editarEvento(
          eventoEmEdicao.id,
          tipo,
          alvo.jogador_id,
          assistenciaId,
        );
        if (!ok) {
          setErro("Não foi possível editar o evento. A partida ainda está ao vivo?");
          return;
        }
      } else {
        const idEvento = await registrarEvento(
          partida.id,
          tipo,
          alvo.jogador_id,
          assistenciaId,
        );
        if (idEvento == null) {
          setErro(
            "Não foi possível registrar o evento. A partida ainda está ao vivo?",
          );
          return;
        }
      }
      setAlvo(null);
      setEventoEmEdicao(null);
      await recarregar();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarRemocao() {
    if (!eventoParaRemover) return;
    setSalvando(true);
    setErro(null);
    try {
      const ok = await removerEvento(eventoParaRemover.id);
      if (!ok) {
        setErro("Não foi possível desfazer o evento.");
        return;
      }
      setEventoParaRemover(null);
      await recarregar();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarFinalizar() {
    if (!partida) return;
    setFinalizando(true);
    setErro(null);
    try {
      const ok = await finalizarPartida(partida.id);
      if (!ok) {
        setErro("Não foi possível finalizar a partida.");
        setConfirmandoFim(false);
        return;
      }
      tocarApito("fim");
      vibrateWhistle();
      setCronometroRodando(false);
      try {
        localStorage.removeItem(CRONOMETRO_STORAGE_KEY);
      } catch {}
      navigate(`/partida/${partida.id}`, { replace: true });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
      setConfirmandoFim(false);
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-2 py-3 pb-36 sm:space-y-4 sm:px-4 sm:py-4 sm:pb-40">
      <Link
        to={`/partida/${partida.id}`}
        className="inline-block cursor-pointer text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </Link>

      <div>
        <h2 className="text-base font-semibold text-neutral-900 sm:text-lg dark:text-neutral-100">
          Partida #{partida.id}
        </h2>
        <p className="text-sm capitalize text-neutral-500 dark:text-neutral-400">
          {formatarDataMobile(partida.data_jogo)}
        </p>
        <p className={`text-xs font-medium ${STATUS_COR[partida.status]}`}>
          {STATUS_LABEL[partida.status]}
        </p>
      </div>

      {/* Widget Cronômetro Integrado & Apito */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-[var(--cor-destaque)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Cronômetro da Partida
            </span>
            {cronometroRodando && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                <span className="size-2 rounded-full bg-emerald-500" />
                EM JOGO
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botão de Apito */}
            <button
              type="button"
              onClick={() => tocarApito("duplo")}
              title="Tocar Apito do Juiz"
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition active:scale-95"
            >
              <Volume2 className="size-3.5" />
              <span>Apito</span>
            </button>
          </div>
        </div>

        {/* Display do tempo */}
        <div className="flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-100">
              {formatarCronometro(cronometroSegundos)}
            </span>
            {acrescimosMinutos > 0 && (
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded">
                +{acrescimosMinutos}'
              </span>
            )}
          </div>

          {/* Controles do cronômetro */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleCronometro}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 min-h-[40px] ${
                  cronometroRodando
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {cronometroRodando ? (
                  <>
                    <Pause className="size-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    <span>Iniciar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetCronometro}
                title="Zerar cronômetro"
                className="flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 min-h-[40px] min-w-[40px]"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Acréscimos (somente admin e quando ao vivo) */}
        {isAdmin && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Acréscimos:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAdicionarAcrescimo(1)}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 active:scale-95"
              >
                <Plus className="size-3" /> 1 min
              </button>
              <button
                type="button"
                onClick={() => handleAdicionarAcrescimo(2)}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 active:scale-95"
              >
                <Plus className="size-3" /> 2 min
              </button>
              <button
                type="button"
                onClick={() => handleAdicionarAcrescimo(3)}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 active:scale-95"
              >
                <Plus className="size-3" /> 3 min
              </button>
            </div>
          </div>
        )}
      </div>

      {partida.status === "draft" && (
        <MensagemEstado tipo="info">
          {isAdmin
            ? "Abra a partida para começar a registrar gols no campo."
            : "A partida ainda não começou."}
        </MensagemEstado>
      )}

      {aoVivo && !isAdmin && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Placar ao vivo. Só o admin registra os eventos.
        </p>
      )}

      {aoVivo && isAdmin && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Toque em um jogador para lançar gol ou gol contra. Toque num evento
          para editar.
        </p>
      )}

      <CampoPartida
        participantes={participantes}
        placar={placar}
        onJogadorClick={
          podeRegistrar
            ? (jogador) => {
                setEventoEmEdicao(null);
                setAlvo(jogador);
              }
            : undefined
        }
        jogadorDestaqueId={alvo?.jogador_id}
      />

      <section className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
          Eventos ({eventos.length})
        </div>
        {eventos.length === 0 ? (
          <p className="px-3 py-3 text-sm text-neutral-400">Nenhum evento ainda.</p>
        ) : (
          <ul className="max-h-40 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
            {[...eventos].reverse().map((evento) => (
              <li
                key={evento.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  disabled={!podeRegistrar}
                  onClick={() => podeRegistrar && abrirEdicao(evento)}
                  className={`flex-1 cursor-pointer rounded-md py-1 text-left text-neutral-900 disabled:cursor-default dark:text-neutral-100`}
                >
                  {evento.tipo === "gol" ? (
                    <>
                      ⚽ {nomeDoJogador(participantes, evento.jogador_id)}
                      {evento.assistencia_jogador_id != null && (
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {" "}
                          · 🅰️{" "}
                          {nomeDoJogador(
                            participantes,
                            evento.assistencia_jogador_id,
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-red-600 dark:text-red-400">GC</span>{" "}
                      {nomeDoJogador(participantes, evento.jogador_id)}
                    </>
                  )}
                </button>
                {podeRegistrar && (
                  <>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(evento)}
                      className="cursor-pointer rounded-md px-2 text-xs font-medium text-[var(--cor-destaque)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventoParaRemover(evento)}
                      className="cursor-pointer rounded-md px-2 text-xs text-red-600 dark:text-red-400"
                    >
                      Desfazer
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {isAdmin && partida.status === "draft" && (
        <div
          className="fixed inset-x-0 z-40 border-t border-neutral-200 bg-neutral-50/90 p-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={confirmarAbrir}
              disabled={abrindo}
              className="w-full cursor-pointer rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white active:scale-95 disabled:opacity-40"
            >
              {abrindo ? "Abrindo…" : "Abrir partida"}
            </button>
          </div>
        </div>
      )}

      {isAdmin && aoVivo && (
        <div
          className="fixed inset-x-0 z-40 border-t border-neutral-200 bg-neutral-50/90 p-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => setConfirmandoFim(true)}
              className="w-full cursor-pointer rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white active:scale-95"
            >
              Finalizar partida
            </button>
            <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Grava o resultado e abre a votação por 24h.
            </p>
          </div>
        </div>
      )}

      <DialogoEvento
        jogador={alvo}
        companheiros={companheiros}
        jogadores={participantes}
        salvando={salvando}
        editando={eventoEmEdicao != null}
        tipoAtual={eventoEmEdicao?.tipo}
        assistenciaAtual={eventoEmEdicao?.assistencia_jogador_id}
        onClose={() => {
          if (!salvando) {
            setAlvo(null);
            setEventoEmEdicao(null);
          }
        }}
        onTrocarJogador={setAlvo}
        onConfirmar={confirmarEvento}
      />

      <ConfirmDialog
        open={eventoParaRemover != null}
        onClose={() => setEventoParaRemover(null)}
        onConfirm={confirmarRemocao}
        titulo="Desfazer este evento?"
        mensagem="O placar e as estatísticas da partida ao vivo serão atualizados."
        textoConfirmar={salvando ? "Desfazendo…" : "Desfazer"}
        tomConfirmar="perigo"
      />

      <ConfirmDialog
        open={confirmandoFim}
        onClose={() => setConfirmandoFim(false)}
        onConfirm={confirmarFinalizar}
        titulo="Finalizar partida?"
        mensagem={`Preto ${placar.gols_time_a} × ${placar.gols_time_b} Branco. Isso grava gols, assistências e gols contra e abre a votação por 24h.`}
        textoConfirmar={finalizando ? "Finalizando…" : "Finalizar"}
      />
    </div>
  );
}
