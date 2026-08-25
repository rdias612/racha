import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { TIMES, POSICOES, type TimeId } from '../lib/times';
import { isRandomUsername, listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import {
  abrirPartida,
  carregarPartida,
  carregarPlacar,
  carregarParticipantes,
  carregarNotas,
  descartarVotos,
  confirmarPresenca,
  adminDefinirConfirmacao,
  adicionarParticipante,
  removerParticipanteDraft,
  vagasOcupadas,
  podeConfirmar,
  CAPACIDADE_PARTIDA,
  STATUS_CONFIRMACAO_LABEL,
  STATUS_LABEL,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
  type StatusConfirmacao,
} from '../lib/partidas';
import { MensagemEstado } from '../components/Estado';
import { SkeletonDetalhe } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatarDataCompleta, formatarDataMobile, formatarFechamento } from '../lib/formatacao';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { voltar } from '../lib/navegacao';
import { vibrateLight, vibrateSuccess } from '../lib/haptics';
import { formatarMensagemErro } from '../lib/erros';

export function PartidaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [notas, setNotas] = useState<NotaPartida[]>([]);
  const [jaVotou, setJaVotou] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!id) return;
      setCarregando(true);
      setErro(null);
      try {
        const numeroId = Number(id);

        // Todas as queries dependem apenas do id da rota: disparam em paralelo.
        // Count de votos é tolerante a falhas (jaVotou = false) para não derrubar a tela.
        const contarVotos = jogadorLogado
          ? (async () => {
              try {
                const { count } = await supabase
                  .from('votes')
                  .select('*', { count: 'exact', head: true })
                  .eq('partida_id', numeroId)
                  .eq('voter_id', jogadorLogado.id);
                return count ?? 0;
              } catch {
                return 0;
              }
            })()
          : Promise.resolve(0);

        const [p, pl, parts, ns, votos] = await Promise.all([
          carregarPartida(numeroId),
          carregarPlacar(numeroId),
          carregarParticipantes(numeroId),
          carregarNotas(numeroId),
          contarVotos,
        ]);
        if (isAtivo && !isAtivo()) return;
        setPartida(p);
        if (p) {
          setPlacar(pl);
          setParticipantes(parts);
          setNotas(ns);
          // O count só vira voto quando a partida está publicada e há jogador logado
          setJaVotou(p.status === 'published' && !!jogadorLogado && votos > 0);
        }
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [id, jogadorLogado]
  );

  async function confirmarDescarte() {
    if (!partida || !jogadorLogado) return;
    setDescartando(true);
    try {
      const ok = await descartarVotos(partida.id, jogadorLogado.id);
      if (ok) {
        setConfirmandoDescarte(false);
        setJaVotou(false);
        navigate(`/partida/${partida.id}/votar`);
      } else {
        setConfirmandoDescarte(false);
        setErro('Não foi possível descartar — a votação pode estar encerrada.');
      }
    } catch (e) {
      setConfirmandoDescarte(false);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setDescartando(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (carregando) return <SkeletonDetalhe />;
  if (!partida)
    return (
      <MensagemEstado tipo={erro ? 'erro' : 'info'} className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro ?? 'Partida não encontrada.'}
      </MensagemEstado>
    );

  async function confirmarAbrir() {
    if (!partida) return;
    setAbrindo(true);
    setErro(null);
    try {
      const ok = await abrirPartida(partida.id);
      if (!ok) {
        setErro('Não foi possível abrir. Confira se os dois times têm 8 jogadores.');
        return;
      }
      navigate(`/partida/${partida.id}/ao-vivo`, { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAbrindo(false);
    }
  }

  const participantesDoTime = (t: TimeId) =>
    participantes
      .filter((p) => p.time === t)
      .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias);

  const craque = notas.find((n) => n.is_craque) ?? null;
  const votacaoAberta =
    partida.status === 'published' &&
    partida.voting_closes_at &&
    new Date(partida.voting_closes_at) > new Date();
  const jaEhParticipante =
    !!jogadorLogado && participantes.some((p) => p.jogador_id === jogadorLogado.id);
  const isRandom = !!jogadorLogado && isRandomUsername(jogadorLogado.username);

  return (
    <div className="px-3 py-4 pb-16 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <button
        onClick={() => voltar(navigate, '/jogos')}
        className="text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        ← voltar
      </button>

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
        <div className="text-right flex flex-col items-end">
          <Badge variante="status" status={partida.status}>
            {STATUS_LABEL[partida.status]}
          </Badge>
          {partida.status === 'published' && partida.voting_closes_at && (
            <p className="text-[10px] font-mono text-destaque mt-1">
              Urna fecha {formatarFechamento(partida.voting_closes_at)}
            </p>
          )}
        </div>
      </div>

      {/* Placar: Painel de LED — Barra horizontal única em preto absoluto com blocos sólidos */}
      {placar && partida.status !== 'draft' && (
        <div className="rounded-[4px] overflow-hidden border-2 border-borda bg-[#000000] shadow-carimbo-preto">
          <div className="flex items-stretch">
            {/* Bloco Lateral: Time Preto */}
            <div className="flex-1 py-3 px-2.5 text-center border-r border-[#35302a] flex flex-col items-center justify-center bg-[#0d0d0e] text-[#f4f1e8]">
              <span className="font-display font-bold text-[10px] uppercase tracking-wider text-giz-fraco">
                TIME
              </span>
              <span className="font-display font-black text-sm sm:text-base uppercase tracking-widest text-[#f4f1e8]">
                PRETO
              </span>
            </div>

            {/* Centro: LED Placar */}
            <div className="px-4 sm:px-8 py-3 flex flex-col items-center justify-center bg-[#000000] min-w-[130px]">
              <span
                className={`text-5xl sm:text-6xl font-display font-black tabular-nums tracking-tight leading-none ${
                  partida.status === 'live'
                    ? 'text-destaque [text-shadow:0_0_14px_rgba(255,179,0,0.55)]'
                    : partida.status === 'closed'
                      ? 'text-giz'
                      : 'text-destaque'
                }`}
              >
                {placar.gols_time_a} <span className="text-giz-fraco/50 font-normal">×</span>{' '}
                {placar.gols_time_b}
              </span>
              {partida.status === 'live' && (
                <span className="flex items-center gap-1.5 text-[9px] font-display font-bold uppercase tracking-widest text-destaque animate-pulse mt-1">
                  <span className="size-1.5 rounded-full bg-destaque" /> AO VIVO
                </span>
              )}
            </div>

            {/* Bloco Lateral: Time Branco */}
            <div className="flex-1 py-3 px-2.5 text-center border-l border-[#35302a] flex flex-col items-center justify-center bg-[#f4f1e8] text-[#0d0d0e]">
              <span className="font-display font-bold text-[10px] uppercase tracking-wider text-neutral-600">
                TIME
              </span>
              <span className="font-display font-black text-sm sm:text-base uppercase tracking-widest text-[#0d0d0e]">
                BRANCO
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card do Craque da Partida (quando closed) */}
      {partida.status === 'closed' && craque && (
        <div className="relative rounded-[4px] border-2 border-destaque bg-superficie p-4 text-center flex flex-col items-center gap-2 shadow-carimbo -rotate-1">
          {/* Fita adesiva translúcida no canto */}
          <div className="absolute -top-2.5 -right-2.5 w-10 h-3.5 bg-destaque/30 rotate-45 pointer-events-none rounded-xs border border-destaque/40" />

          <div className="bg-[#0d0d0e] border border-destaque/40 text-destaque font-display font-black text-xs uppercase tracking-[0.2em] px-4 py-0.5 rounded-[2px] shadow-xs">
            CRAQUE DA PARTIDA
          </div>

          <div className="flex items-center justify-center gap-4 my-1">
            <div className="text-right">
              <span className="block font-mono text-3xl sm:text-4xl font-black text-destaque tabular-nums leading-none">
                {Number(craque.avg_rating).toFixed(1)}
              </span>
              <span className="text-[10px] font-mono text-giz-fraco uppercase">
                {craque.vote_count} votos
              </span>
            </div>
            <div className="ring-2 ring-destaque ring-offset-2 ring-offset-superficie rounded-[3px]">
              <Avatar username={craque.username} size="lg" />
            </div>
          </div>

          <p className="font-display font-bold text-lg uppercase tracking-wide text-giz">
            @{craque.username}
          </p>
        </div>
      )}

      {/* Notas reveladas quando closed */}
      {partida.status === 'closed' && notas.length > 0 && (
        <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
          <div className="px-3 py-2 bg-superficie-2 border-b border-borda text-xs font-display font-bold uppercase tracking-wider text-giz">
            Notas da Partida (Súmula)
          </div>
          <div className="divide-y divide-borda">
            {[...notas]
              .sort(
                (a, b) => Number(b.avg_rating) - Number(a.avg_rating) || b.vote_count - a.vote_count
              )
              .map((n) => (
                <div
                  key={n.target_id}
                  className="flex items-center justify-between px-3 py-2 text-sm hover:bg-superficie-2 transition"
                >
                  <div className="flex items-center gap-2 text-giz">
                    <Avatar username={n.username} size="xs" />
                    <span className="font-medium">
                      {n.is_craque ? '⭐ ' : ''}
                      @{n.username}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-destaque tabular-nums">
                    {Number(n.avg_rating).toFixed(1)}{' '}
                    <span className="text-xs font-normal text-giz-fraco font-mono">
                      ({n.vote_count}v)
                    </span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {partida.status === 'draft' && (
        <Confirmacoes
          partida={partida}
          participantes={participantes}
          jogadorLogadoId={jogadorLogado?.id ?? null}
          isAdmin={isAdmin}
          onAtualizar={carregar}
        />
      )}

      {(partida.status !== 'draft' || participantes.some((p) => p.time !== null)) && (
        <>
          {/* Times com gols/assists/gols contra */}
          <div className="grid grid-cols-2 gap-3">
            {(['a', 'b'] as TimeId[]).map((t) => {
              const jogadoresDoTime = participantesDoTime(t);
              return (
                <div
                  key={t}
                  className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo"
                >
                  <div
                    className="px-3 py-2 text-xs font-display font-bold uppercase tracking-wider border-b border-borda"
                    style={{
                      backgroundColor: TIMES[t].cor,
                      color: t === 'a' ? '#f4f1e8' : '#0d0d0e',
                    }}
                  >
                    {TIMES[t].nome} ({jogadoresDoTime.length})
                  </div>
                  <div className="divide-y divide-borda">
                    {jogadoresDoTime.map((p) => (
                      <div
                        key={p.jogador_id}
                        className="flex items-center justify-between px-2.5 py-2 text-xs hover:bg-superficie-2 transition"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar username={p.username ?? ''} posicao={p.posicao} size="xs" />
                          <span className="truncate font-medium text-giz">
                            {p.username ? `@${p.username}` : `#${p.jogador_id}`}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 font-mono text-[11px]">
                          {p.gols > 0 && (
                            <span className="font-bold text-destaque" title="Gols">
                              ⚽{p.gols}
                            </span>
                          )}
                          {p.assistencias > 0 && (
                            <span className="font-medium text-giz-fraco" title="Assistências">
                              🅰️{p.assistencias}
                            </span>
                          )}
                          {p.gols_contra > 0 && (
                            <span className="font-bold text-perigo" title="Gol contra">
                              GC:{p.gols_contra}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {jogadoresDoTime.length === 0 && (
                      <div className="px-3 py-3 text-xs font-mono text-giz-fraco text-center">
                        Sem jogadores escalados
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Ações principais por status */}
      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/times`}
            className="block text-center rounded-[4px] border border-borda bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo hover:bg-superficie transition active:translate-y-px"
          >
            Escalar Times
          </Link>
          <button
            type="button"
            disabled={abrindo}
            onClick={confirmarAbrir}
            className="w-full rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px disabled:opacity-40"
          >
            {abrindo ? 'Iniciando partida…' : 'Iniciar Modo Ao Vivo'}
          </button>
        </div>
      )}

      {partida.status === 'live' && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/ao-vivo`}
            className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px"
          >
            {isAdmin ? 'Registrar Eventos na Súmula' : 'Acompanhar Ao Vivo'}
          </Link>
        </div>
      )}

      {(partida.status === 'published' || partida.status === 'closed') && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center rounded-[4px] border border-borda bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo hover:bg-superficie transition active:translate-y-px"
          >
            Editar partida e súmula
          </Link>
        </div>
      )}

      {votacaoAberta && jaEhParticipante && !isRandom && (
        <div className="space-y-2">
          {jaVotou ? (
            <>
              <p className="text-center text-xs font-mono text-ok">
                Seu voto tá garantido. Dá pra mudar até as urnas fecharem.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/partida/${partida.id}/votar`}
                  className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px"
                >
                  Editar votos
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmandoDescarte(true)}
                  className="block text-center rounded-[4px] border border-perigo/50 bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-perigo shadow-carimbo hover:bg-perigo/10 transition active:translate-y-px"
                >
                  Descartar votos
                </button>
              </div>
            </>
          ) : (
            <Link
              to={`/partida/${partida.id}/votar`}
              className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px"
            >
              Votar nos Jogadores (Craque da Quinta)
            </Link>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmandoDescarte}
        onClose={() => setConfirmandoDescarte(false)}
        onConfirm={confirmarDescarte}
        titulo="Descartar seus votos?"
        mensagem="Isso vai apagar todas as notas que você deu nesta partida. Você poderá votar novamente enquanto a votação estiver aberta."
        textoConfirmar={descartando ? 'Descartando…' : 'Descartar'}
        tomConfirmar="perigo"
      />

      {partida.status === 'published' && !votacaoAberta && (
        <p className="text-center text-xs font-mono text-destaque">
          As urnas fecharam. O craque está sendo apurado.
        </p>
      )}
    </div>
  );
}

type PropsBotoes = {
  status: StatusConfirmacao;
  podeConf: boolean;
  ocupadas: number;
  processando: boolean;
  onAtualizar: (alvo: StatusConfirmacao) => void;
};

// Botões do próprio jogador (confirma/desconfirma/recusa a própria presença).
function BotoesSelf({ status, podeConf, ocupadas, processando, onAtualizar }: PropsBotoes) {
  const btn =
    'min-h-[44px] rounded-[3px] border px-3 text-xs font-display font-bold uppercase tracking-wider active:translate-y-px transition disabled:opacity-40';
  const lotado = ocupadas >= CAPACIDADE_PARTIDA;
  return (
    <>
      {status !== 'confirmado' && (
        <button
          type="button"
          disabled={processando || !podeConf}
          onClick={() => onAtualizar('confirmado')}
          title={lotado ? 'Vagas esgotadas' : undefined}
          className={`${btn} border-destaque bg-destaque/15 text-destaque shadow-xs hover:bg-destaque hover:text-destaque-tinta`}
        >
          Vou jogar
        </button>
      )}
      {status === 'confirmado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('pendente')}
          className={`${btn} border-borda bg-superficie-2 text-giz-fraco hover:text-giz`}
        >
          Desconfirmar
        </button>
      )}
      {status !== 'recusado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('recusado')}
          className={`${btn} border-perigo/40 text-perigo hover:bg-perigo/10`}
        >
          Essa quinta não rola
        </button>
      )}
    </>
  );
}

// Controles do admin (pode mexer em qualquer jogador com alvos de 44px).
function BotoesAdmin({
  status,
  podeConf,
  processando,
  onAtualizar,
  onRemover,
}: PropsBotoes & { onRemover?: () => void }) {
  const mini =
    'min-h-[44px] min-w-[44px] rounded-[3px] border text-xs font-display font-bold uppercase active:translate-y-px transition disabled:opacity-30 flex items-center justify-center';
  const off = 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={processando || (status !== 'confirmado' && !podeConf)}
        onClick={() => onAtualizar('confirmado')}
        title="Confirmar"
        className={`${mini} ${
          status === 'confirmado' ? 'border-ok bg-ok/20 text-ok font-bold' : off
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => onAtualizar('pendente')}
        title="Pendente"
        className={`${mini} ${
          status === 'pendente' ? 'border-destaque bg-destaque/20 text-destaque font-bold' : off
        }`}
      >
        ⏳
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => onAtualizar('recusado')}
        title="Não vai"
        className={`${mini} ${
          status === 'recusado' ? 'border-perigo bg-perigo/20 text-perigo font-bold' : off
        }`}
      >
        ✗
      </button>
      {onRemover && (
        <button
          type="button"
          disabled={processando}
          onClick={onRemover}
          title="Remover convite"
          className={`${mini} ${off} hover:border-perigo hover:text-perigo`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Confirmacoes({
  partida,
  participantes,
  jogadorLogadoId,
  isAdmin,
  onAtualizar,
}: {
  partida: Partida;
  participantes: Participante[];
  jogadorLogadoId: number | null;
  isAdmin: boolean;
  onAtualizar: () => Promise<void> | void;
}) {
  const [participantesLocais, setParticipantesLocais] = useState<Participante[]>(participantes);
  const [processando, setProcessando] = useState<number | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [mostrandoAvulso, setMostrandoAvulso] = useState(false);
  const [todosAtivos, setTodosAtivos] = useState<JogadorLista[]>([]);

  useEffect(() => {
    setParticipantesLocais(participantes);
  }, [participantes]);

  const closesAt = partida.confirmacao_closes_at;
  const agora = new Date();
  const prazoPassou = !!closesAt && agora.getTime() >= new Date(closesAt).getTime();
  const ocupadas = vagasOcupadas(participantesLocais, closesAt, agora);
  const livres = Math.max(0, CAPACIDADE_PARTIDA - ocupadas);

  const ordenados = [...participantesLocais].sort((a, b) => {
    const peso = (s: StatusConfirmacao) => (s === 'confirmado' ? 0 : s === 'pendente' ? 1 : 2);
    return (
      peso(a.status_confirmacao) - peso(b.status_confirmacao) ||
      (a.username ?? '').localeCompare(b.username ?? '')
    );
  });

  async function atualizar(jogadorId: number, alvo: StatusConfirmacao) {
    setErroLocal(null);
    setProcessando(jogadorId);
    if (alvo === 'confirmado') vibrateSuccess();
    else vibrateLight();

    // Atualização otimista imediata
    const anterior = participantesLocais;
    setParticipantesLocais((prev) =>
      prev.map((p) => (p.jogador_id === jogadorId ? { ...p, status_confirmacao: alvo } : p))
    );

    try {
      const ehSelf = jogadorId === jogadorLogadoId;
      const ok =
        !ehSelf && isAdmin && jogadorLogadoId != null
          ? await adminDefinirConfirmacao(partida.id, jogadorId, alvo, jogadorLogadoId)
          : await confirmarPresenca(partida.id, jogadorId, alvo);
      if (!ok) {
        setParticipantesLocais(anterior); // Rollback
        setErroLocal('Não foi possível atualizar — confira as vagas disponíveis.');
      } else {
        await onAtualizar();
      }
    } catch (e) {
      setParticipantesLocais(anterior); // Rollback
      setErroLocal(formatarMensagemErro(e));
    } finally {
      setProcessando(null);
    }
  }

  async function remover(jogadorId: number) {
    setErroLocal(null);
    setProcessando(jogadorId);
    try {
      await removerParticipanteDraft(partida.id, jogadorId);
      await onAtualizar();
    } catch (e) {
      setErroLocal(formatarMensagemErro(e));
    } finally {
      setProcessando(null);
    }
  }

  async function adicionar(jogadorId: number) {
    setErroLocal(null);
    setProcessando(jogadorId);
    try {
      const ok = await adicionarParticipante(partida.id, jogadorId);
      if (!ok) {
        setErroLocal('Não foi possível adicionar — pode não haver vaga.');
      } else {
        setMostrandoAvulso(false);
        await onAtualizar();
      }
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(null);
    }
  }

  async function abrirAvulso() {
    setMostrandoAvulso((v) => !v);
    if (todosAtivos.length === 0) {
      try {
        setTodosAtivos(await listarJogadoresAtivos());
      } catch {
        /* ignora erro de listagem */
      }
    }
  }

  const idsNoElenco = new Set(participantes.map((p) => p.jogador_id));
  const candidatosAvulso = todosAtivos.filter((j) => !idsNoElenco.has(j.id));

  return (
    <section className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo">
      <div className="px-3 py-2 bg-superficie-2 border-b border-borda flex items-center justify-between">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          Confirmações de Presença
        </h3>
        <span className="font-mono text-xs font-bold text-destaque tabular-nums">
          {ocupadas}/{CAPACIDADE_PARTIDA} vagas
        </span>
      </div>

      {closesAt && (
        <p className="px-3 pt-2 text-[11px] font-mono text-giz-fraco">
          {prazoPassou
            ? 'Prazo encerrado — vagas remanescentes liberadas (primeiro a confirmar leva).'
            : `Reservas liberadas ${formatarFechamento(closesAt)}.`}
        </p>
      )}

      <div className="divide-y divide-borda">
        {ordenados.map((p) => {
          const ehSelf = p.jogador_id === jogadorLogadoId;
          const podeConf = podeConfirmar(p, 'confirmado', participantes, closesAt, agora);
          return (
            <div
              key={p.jogador_id}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-superficie-2 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar username={p.username ?? ''} size="xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-giz">
                    {p.username ? `@${p.username}` : `#${p.jogador_id}`}
                    {ehSelf && (
                      <span className="ml-1 text-[10px] font-mono text-destaque">(você)</span>
                    )}
                  </p>
                  <Badge variante="status" status={p.status_confirmacao}>
                    {STATUS_CONFIRMACAO_LABEL[p.status_confirmacao]}
                  </Badge>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {ehSelf ? (
                  <BotoesSelf
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                  />
                ) : isAdmin ? (
                  <BotoesAdmin
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                    onRemover={() => remover(p.jogador_id)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {ordenados.length === 0 && (
          <div className="px-3 py-3 text-xs font-mono text-giz-fraco">Nenhum convite ainda.</div>
        )}
      </div>

      {isAdmin && livres > 0 && (
        <div className="border-t border-borda">
          <button
            type="button"
            onClick={abrirAvulso}
            className="w-full px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-destaque hover:bg-superficie-2 transition"
          >
            {mostrandoAvulso
              ? 'Fechar seleção'
              : `+ Adicionar Avulso (${livres} vaga${livres > 1 ? 's' : ''})`}
          </button>
          {mostrandoAvulso && (
            <div className="max-h-52 overflow-y-auto divide-y divide-borda">
              {candidatosAvulso.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={processando !== null}
                  onClick={() => adicionar(j.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-giz hover:bg-superficie-2 active:translate-y-px transition"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar username={j.username} size="xs" />
                    <span className="truncate font-medium">@{j.username}</span>
                  </span>
                  <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                    {POSICOES[j.posicao]}
                  </span>
                </button>
              ))}
              {candidatosAvulso.length === 0 && (
                <div className="px-3 py-3 text-xs font-mono text-giz-fraco">
                  Nenhum jogador disponível.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {erroLocal && (
        <p className="px-3 py-2 text-xs font-mono text-perigo border-t border-borda bg-perigo/10">
          {erroLocal}
        </p>
      )}
    </section>
  );
}
