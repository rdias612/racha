import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CampoPartida } from "../components/CampoPartida";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DialogoEvento } from "../components/DialogoEvento";
import { Carregando, MensagemEstado } from "../components/Estado";
import { useAdmin } from "../hooks/useAdmin";
import { formatarDataMobile, formatarNome } from "../lib/formatacao";
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
        mensagem={`Placar ${placar.gols_time_b} × ${placar.gols_time_a}. Isso grava gols, assistências e gols contra e abre a votação por 24h.`}
        textoConfirmar={finalizando ? "Finalizando…" : "Finalizar"}
      />
    </div>
  );
}
