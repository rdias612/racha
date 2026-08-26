import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CampoPartida } from '../components/CampoPartida';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DialogoEvento } from '../components/DialogoEvento';
import { Carregando, MensagemEstado } from '../components/Estado';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { invalidarCache } from '../hooks/useCache';
import { formatarDataMobile, formatarDataCompleta } from '../lib/formatacao';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { BarraAcaoInferior } from '../components/BarraAcaoInferior';
import { formatarMensagemErro } from '../lib/erros';
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
  STATUS_LABEL,
  type EventoPartida,
  type Participante,
  type Partida,
  type TipoEvento,
} from '../lib/partidas';

function nomeDoJogador(participantes: Participante[], jogadorId: number | null): string {
  if (jogadorId == null) return '';
  const username = participantes.find((p) => p.jogador_id === jogadorId)?.username;
  return username ? `@${username}` : `#${jogadorId}`;
}

export function PartidaAoVivo() {
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();

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
  const [eventoParaRemover, setEventoParaRemover] = useState<EventoPartida | null>(null);
  const [eventoEmEdicao, setEventoEmEdicao] = useState<EventoPartida | null>(null);

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
        if (ativo) setErro(formatarMensagemErro(e, 'Erro ao carregar partida.'));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [recarregar]);

  useEffect(() => {
    if (partida?.status !== 'live') return;
    const intervalo = setInterval(() => {
      recarregar().catch(() => {});
    }, 10_000);
    return () => clearInterval(intervalo);
  }, [partida?.status, recarregar]);

  const placar = useMemo(() => placarDeEventos(eventos, participantes), [eventos, participantes]);

  const companheiros = useMemo(() => {
    if (!alvo) return [];
    return participantes
      .filter((p) => p.time === alvo.time && p.jogador_id !== alvo.jogador_id)
      .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));
  }, [alvo, participantes]);

  if (!partidaId) return <Navigate to="/jogos" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (!partida) {
    return (
      <MensagemEstado tipo={erro ? 'erro' : 'info'} className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro ?? 'Partida não encontrada.'}
      </MensagemEstado>
    );
  }

  if (partida.status === 'published' || partida.status === 'closed') {
    return <Navigate to={`/partida/${partida.id}`} replace />;
  }

  const aoVivo = partida.status === 'live';
  const podeRegistrar = isAdmin && aoVivo;

  async function confirmarAbrir() {
    if (!partida) return;
    setAbrindo(true);
    setErro(null);
    try {
      const ok = await abrirPartida(partida.id, jogadorLogado?.id ?? null);
      if (!ok) {
        setErro(
          'Não foi possível abrir. Confira se os dois times têm 7 jogadores de linha e 1 goleiro escalados.'
        );
        return;
      }
      invalidarCache('jogos');
      invalidarCache('resumo');
      await recarregar();
    } catch (e: unknown) {
      setErro(formatarMensagemErro(e, 'Não foi possível iniciar a partida.'));
    } finally {
      setAbrindo(false);
    }
  }

  function abrirEdicao(evento: EventoPartida) {
    const jogador = participantes.find((p) => p.jogador_id === evento.jogador_id);
    if (!jogador) return;
    setEventoEmEdicao(evento);
    setAlvo(jogador);
  }

  async function confirmarEvento(tipo: TipoEvento, assistenciaId: number | null) {
    if (!partida || !alvo) return;
    setSalvando(true);
    setErro(null);
    try {
      if (eventoEmEdicao) {
        const ok = await editarEvento(eventoEmEdicao.id, tipo, alvo.jogador_id, assistenciaId);
        if (!ok) {
          setErro('Não foi possível editar o evento. A partida ainda está ao vivo?');
          return;
        }
      } else {
        const idEvento = await registrarEvento(partida.id, tipo, alvo.jogador_id, assistenciaId);
        if (idEvento == null) {
          setErro('Não foi possível registrar o evento. A partida ainda está ao vivo?');
          return;
        }
      }
      setAlvo(null);
      setEventoEmEdicao(null);
      await recarregar();
    } catch (e: unknown) {
      setErro(formatarMensagemErro(e, 'Não foi possível registrar o evento.'));
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
        setErro('Não foi possível desfazer o evento.');
        return;
      }
      setEventoParaRemover(null);
      await recarregar();
    } catch (e: unknown) {
      setErro(formatarMensagemErro(e, 'Não foi possível remover o evento.'));
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
        setErro('Não foi possível finalizar a partida.');
        setConfirmandoFim(false);
        return;
      }
      invalidarCache('jogos');
      invalidarCache('resumo');
      navigate(`/partida/${partida.id}`, { replace: true });
    } catch (e: unknown) {
      setErro(formatarMensagemErro(e, 'Não foi possível finalizar a partida.'));
      setConfirmandoFim(false);
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 py-4 pb-36 sm:px-4 sm:pb-40 text-giz">
      <BotaoVoltar fallback={`/partida/${partida.id}`} />

      {/* Cabeçalho da Súmula */}
      <div className="sumula-header pb-2 flex items-start justify-between">
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Partida #{partida.id}
          </h2>
          <p className="text-xs text-giz-fraco capitalize font-mono mt-0.5">
            <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
            <span className="hidden sm:inline">{formatarDataCompleta(partida.data_jogo)}</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block font-display font-black uppercase tracking-widest text-[10px] border px-2 py-0.5 rounded-[2px] shadow-xs ${
              partida.status === 'live'
                ? 'border-destaque text-destaque bg-destaque/10'
                : 'border-borda text-giz-fraco bg-superficie-2'
            }`}
          >
            {STATUS_LABEL[partida.status]}
          </span>
          {aoVivo && (
            <p className="text-[10px] font-mono text-destaque flex items-center justify-end gap-1 mt-1 animate-pulse">
              <span className="size-1.5 rounded-full bg-destaque" /> AO VIVO
            </p>
          )}
        </div>
      </div>

      {partida.status === 'draft' && (
        <MensagemEstado tipo="info">
          {isAdmin
            ? 'Abra a partida para começar a registrar gols no campo.'
            : 'A partida ainda não começou.'}
        </MensagemEstado>
      )}

      {aoVivo && !isAdmin && (
        <p className="text-xs font-mono text-giz-fraco">
          Placar ao vivo da súmula. Registrado pelo administrador do racha.
        </p>
      )}

      {aoVivo && isAdmin && (
        <p className="text-xs font-mono text-giz-fraco">
          Toque em um jogador no campo para lançar gol ou gol contra. Toque num evento para editar.
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

      <section className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
        <div className="border-b border-borda bg-superficie-2 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-giz flex items-center justify-between">
          <span>Eventos da Súmula</span>
          <span className="font-mono text-destaque font-bold">({eventos.length})</span>
        </div>
        {eventos.length === 0 ? (
          <p className="px-3 py-4 text-xs font-mono text-giz-fraco text-center">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <ul className="max-h-48 divide-y divide-borda overflow-y-auto">
            {[...eventos].reverse().map((evento) => (
              <li
                key={evento.id}
                className="flex items-center justify-between gap-2 px-3 py-1 text-sm hover:bg-superficie-2 transition min-h-[44px]"
              >
                <button
                  type="button"
                  disabled={!podeRegistrar}
                  onClick={() => podeRegistrar && abrirEdicao(evento)}
                  className="flex-1 min-h-[44px] flex items-center cursor-pointer py-1 text-left text-giz disabled:cursor-default"
                >
                  {evento.tipo === 'gol' ? (
                    <span className="font-medium">
                      ⚽ {nomeDoJogador(participantes, evento.jogador_id)}
                      {evento.assistencia_jogador_id != null && (
                        <span className="text-giz-fraco text-xs font-mono">
                          {' '}
                          · 🅰️ {nomeDoJogador(participantes, evento.assistencia_jogador_id)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="font-medium">
                      <span className="text-perigo font-bold font-mono">GC</span>{' '}
                      {nomeDoJogador(participantes, evento.jogador_id)}
                    </span>
                  )}
                </button>
                {podeRegistrar && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(evento)}
                      className="min-h-[44px] inline-flex items-center justify-center cursor-pointer rounded-[2px] border border-destaque/40 bg-destaque/10 px-2.5 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-destaque hover:bg-destaque hover:text-destaque-tinta transition"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventoParaRemover(evento)}
                      className="min-h-[44px] inline-flex items-center justify-center cursor-pointer rounded-[2px] border border-perigo/40 bg-perigo/10 px-2.5 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-perigo hover:bg-perigo hover:text-branco-time transition"
                    >
                      Desfazer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {isAdmin && partida.status === 'draft' && (
        <BarraAcaoInferior>
          <button
            type="button"
            onClick={confirmarAbrir}
            disabled={abrindo}
            className="w-full min-h-[44px] cursor-pointer rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-40"
          >
            {abrindo ? 'Abrindo partida…' : 'Abrir partida ao vivo'}
          </button>
        </BarraAcaoInferior>
      )}

      {isAdmin && aoVivo && (
        <BarraAcaoInferior legenda="Grava o placar final e abre a urna de votação por 24 horas.">
          <button
            type="button"
            onClick={() => setConfirmandoFim(true)}
            className="w-full min-h-[44px] cursor-pointer rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition"
          >
            Finalizar partida e abrir votação
          </button>
        </BarraAcaoInferior>
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
        textoConfirmar={salvando ? 'Desfazendo…' : 'Desfazer'}
        tomConfirmar="perigo"
      />

      <ConfirmDialog
        open={confirmandoFim}
        onClose={() => setConfirmandoFim(false)}
        onConfirm={confirmarFinalizar}
        titulo="Finalizar partida?"
        mensagem={`Placar ${placar.gols_time_a} × ${placar.gols_time_b}. Isso grava gols, assistências e gols contra e abre a votação por 24h.`}
        textoConfirmar={finalizando ? 'Finalizando…' : 'Finalizar'}
      />
    </div>
  );
}
