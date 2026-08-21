import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'
import { useJogadorLogado } from '../hooks/useJogadorLogado'
import { TIMES, POSICOES, type TimeId } from '../lib/times'
import {
  isRandomUsername,
  isSuperAdmin,
  listarJogadoresAtivos,
  type JogadorLista,
} from '../lib/jogadores'
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
  STATUS_COR,
  STATUS_LABEL,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
  type StatusConfirmacao,
} from '../lib/partidas'
import { MensagemEstado } from '../components/Estado'
import { SkeletonDetalhe } from '../components/Skeletons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatarDataCompleta, formatarDataMobile, formatarFechamento } from '../lib/formatacao'
import { Avatar } from '../components/Avatar'

export function PartidaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useAdmin()
  const jogadorLogado = useJogadorLogado()

  const [partida, setPartida] = useState<Partida | null>(null)
  const [placar, setPlacar] = useState<Placar | null>(null)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [notas, setNotas] = useState<NotaPartida[]>([])
  const [jaVotou, setJaVotou] = useState(false)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!id) return
    setCarregando(true)
    setErro(null)
    try {
      const p = await carregarPartida(Number(id))
      setPartida(p)
      if (p) {
        const [pl, parts, ns] = await Promise.all([
          carregarPlacar(p.id),
          carregarParticipantes(p.id),
          carregarNotas(p.id),
        ])
        setPlacar(pl)
        setParticipantes(parts)
        setNotas(ns)

        // Verifica se o jogador logado já votou nesta partida
        if (jogadorLogado && p.status === 'published') {
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('partida_id', p.id)
            .eq('voter_id', jogadorLogado.id)
          setJaVotou((count ?? 0) > 0)
        } else {
          setJaVotou(false)
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarDescarte() {
    if (!partida || !jogadorLogado) return
    setDescartando(true)
    try {
      const ok = await descartarVotos(partida.id, jogadorLogado.id)
      if (ok) {
        setConfirmandoDescarte(false)
        setJaVotou(false)
        navigate(`/partida/${partida.id}/votar`)
      } else {
        setConfirmandoDescarte(false)
        setErro('Não foi possível descartar — a votação pode estar encerrada.')
      }
    } catch (e) {
      setConfirmandoDescarte(false)
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setDescartando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (carregando) return <SkeletonDetalhe />
  if (!partida)
    return (
      <MensagemEstado
        tipo={erro ? 'erro' : 'info'}
        className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl"
      >
        {erro ?? 'Partida não encontrada.'}
      </MensagemEstado>
    )

  async function confirmarAbrir() {
    if (!partida) return
    setAbrindo(true)
    setErro(null)
    try {
      const ok = await abrirPartida(partida.id)
      if (!ok) {
        setErro('Não foi possível abrir. Confira se os dois times têm 8 jogadores.')
        return
      }
      navigate(`/partida/${partida.id}/ao-vivo`, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setAbrindo(false)
    }
  }

  const participantesDoTime = (t: TimeId) =>
    participantes
      .filter((p) => p.time === t)
      .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias)

  const craque = notas.find((n) => n.is_craque) ?? null
  const votacaoAberta =
    partida.status === 'published' &&
    partida.voting_closes_at &&
    new Date(partida.voting_closes_at) > new Date()
  const jaEhParticipante =
    !!jogadorLogado &&
    participantes.some((p) => p.jogador_id === jogadorLogado.id)
  const isRandom = !!jogadorLogado && isRandomUsername(jogadorLogado.username)

  return (
    <div className="px-3 py-4 pb-10 sm:px-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Partida #{partida.id}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
          <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
          <span className="hidden sm:inline">{formatarDataCompleta(partida.data_jogo)}</span>
        </p>
        <p className={`text-xs font-medium ${STATUS_COR[partida.status]}`}>
          {STATUS_LABEL[partida.status]}
          {partida.status === 'published' && partida.voting_closes_at && (
            <> — fecha {formatarFechamento(partida.voting_closes_at)}</>
          )}
        </p>
      </div>

      {/* Placar: some no draft (ainda nao comecou). Em live vem dos eventos sincronizados. */}
      {placar && partida.status !== 'draft' && (
        <div className="flex items-stretch rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <div
            className="flex-1 py-4 text-center text-sm font-medium"
            style={{ backgroundColor: TIMES.a.cor, color: '#f9fafb' }}
          >
            <span className="sm:hidden">Preto</span>
            <span className="hidden sm:inline">Time Preto</span>
          </div>
          <div className="px-5 sm:px-8 py-4 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
            <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight text-neutral-900 dark:text-neutral-100">
              {placar.gols_time_a} × {placar.gols_time_b}
            </span>
          </div>
          <div
            className="flex-1 py-4 text-center text-sm font-medium border-l border-neutral-200 dark:border-neutral-800"
            style={{ backgroundColor: TIMES.b.cor, color: '#111827' }}
          >
            <span className="sm:hidden">Branco</span>
            <span className="hidden sm:inline">Time Branco</span>
          </div>
        </div>
      )}

      {/* Craque da partida (só quando closed) */}
      {partida.status === 'closed' && craque && (
        <div className="rounded-lg border border-destaque bg-destaque/10 px-4 py-3 text-center flex flex-col items-center gap-1.5">
          <p className="text-xs uppercase tracking-wide text-destaque font-semibold">
            ⭐ Craque da partida
          </p>
          <Avatar nome={craque.nome} size="lg" />
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {craque.nome}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            nota {Number(craque.avg_rating).toFixed(1)} ({craque.vote_count} votos)
          </p>
        </div>
      )}

      {/* Notas reveladas quando closed */}
      {partida.status === 'closed' && notas.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Notas da partida
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {[...notas]
              .sort(
                (a, b) =>
                  Number(b.avg_rating) - Number(a.avg_rating) ||
                  b.vote_count - a.vote_count,
              )
              .map((n) => (
                <div
                  key={n.target_id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Avatar nome={n.nome} size="xs" />
                    <span>
                      {n.is_craque ? '⭐ ' : ''}
                      {n.nome}
                    </span>
                  </div>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {Number(n.avg_rating).toFixed(1)}{' '}
                    <span className="text-xs">({n.vote_count})</span>
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

      {(partida.status !== 'draft' ||
        participantes.some((p) => p.time !== null)) && (
        <>
          {/* Times com gols/assists/gols contra */}
          <div className="grid grid-cols-2 gap-3">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const jogadoresDoTime = participantesDoTime(t)
          return (
            <div
              key={t}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              <div
                className="px-3 py-2 text-xs font-semibold border-b border-neutral-200 dark:border-neutral-800"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === 'a' ? '#f9fafb' : '#111827',
                }}
              >
                {TIMES[t].nome}
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {jogadoresDoTime.map((p) => (
                  <div
                    key={p.jogador_id}
                    className="flex items-center justify-between gap-1.5 px-3 py-2 text-xs min-h-[36px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {p.nome}
                      </span>
                      {(p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
                          {p.gols > 0 && <span>⚽ {p.gols}</span>}
                          {p.assistencias > 0 && <span>🅰️ {p.assistencias}</span>}
                          {p.gols_contra > 0 && <span>GC {p.gols_contra}</span>}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase text-neutral-400 dark:text-neutral-500 shrink-0">
                      {POSICOES[p.posicao]}
                    </span>
                  </div>
                ))}
                {jogadoresDoTime.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-400">—</div>
                )}
              </div>
            </div>
          )
        })}
          </div>
        </>
      )}

      {/* Botões de Ação por Status */}
      {isAdmin && (
        <div className="flex gap-2">
          {partida.status !== 'live' && (
            <Link
              to={`/partida/${partida.id}/editar`}
              className="flex-1 text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              Editar partida
            </Link>
          )}
          {partida.status === 'draft' && (
            <Link
              to={`/partida/${partida.id}/times`}
              className="flex-1 text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              Escalar times
            </Link>
          )}
        </div>
      )}

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Escale os times (8 por time, 1 goleiro cada) e depois abra a partida para registrar os gols no campo.
          </p>
          <Link
            to={`/partida/${partida.id}/times`}
            className="block text-center rounded-lg bg-destaque px-4 py-3 font-medium text-white"
          >
            Escalar times
          </Link>
          <button
            type="button"
            onClick={confirmarAbrir}
            disabled={abrindo}
            className="block w-full text-center rounded-lg border border-destaque px-4 py-3 font-medium text-destaque disabled:opacity-40"
          >
            {abrindo ? 'Abrindo…' : 'Abrir partida'}
          </button>
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300"
          >
            Lançar resultado / editar escalação
          </Link>
        </div>
      )}

      {partida.status === 'live' && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/ao-vivo`}
            className="block text-center rounded-lg bg-destaque px-4 py-3 font-medium text-white"
          >
            {isAdmin ? 'Registrar eventos' : 'Acompanhar ao vivo'}
          </Link>
        </div>
      )}

      {(partida.status === 'published' || (partida.status === 'closed' && isSuperAdmin(jogadorLogado?.username))) && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/editar`}
            className={
              partida.status === 'closed'
                ? 'block text-center rounded-lg bg-amber-500 dark:bg-amber-600 px-4 py-3 font-medium text-white'
                : 'block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300'
            }
          >
            Editar partida e resultado
          </Link>
        </div>
      )}

      {votacaoAberta && jaEhParticipante && !isRandom && (
        <div className="space-y-2">
          {jaVotou ? (
            <>
              <p className="text-center text-xs text-green-600 dark:text-green-400">
                ✓ Você já votou. Pode editar ou descartar até a votação fechar.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/partida/${partida.id}/votar`}
                  className="block text-center rounded-lg bg-destaque px-4 py-3 font-medium text-white"
                >
                  Editar votos
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmandoDescarte(true)}
                  className="block text-center rounded-lg border border-red-300 dark:border-red-900 px-4 py-3 font-medium text-red-600 dark:text-red-400"
                >
                  Descartar votos
                </button>
              </div>
            </>
          ) : (
            <Link
              to={`/partida/${partida.id}/votar`}
              className="block text-center rounded-lg bg-destaque px-4 py-3 font-medium text-white"
            >
              Votar
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
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          Votação encerrada — aguardando resultado.
        </p>
      )}
    </div>
  )
}

function BadgeStatus({ status }: { status: StatusConfirmacao }) {
  const cls: Record<StatusConfirmacao, string> = {
    confirmado: 'text-green-600 dark:text-green-400',
    pendente: 'text-neutral-500 dark:text-neutral-400',
    recusado: 'text-red-600 dark:text-red-400',
  }
  const icon: Record<StatusConfirmacao, string> = {
    confirmado: '✓ ',
    pendente: '⏳ ',
    recusado: '✗ ',
  }
  return (
    <span className={`text-[11px] font-medium ${cls[status]}`}>
      {icon[status]}
      {STATUS_CONFIRMACAO_LABEL[status]}
    </span>
  )
}

type PropsBotoes = {
  status: StatusConfirmacao
  podeConf: boolean
  ocupadas: number
  processando: boolean
  onAtualizar: (alvo: StatusConfirmacao) => void
}

// Botões do próprio jogador (confirma/desconfirma/recusa a própria presença).
function BotoesSelf({ status, podeConf, ocupadas, processando, onAtualizar }: PropsBotoes) {
  const btn =
    'min-h-[32px] rounded-md border px-2 text-[11px] font-medium active:scale-95 transition disabled:opacity-40'
  const lotado = ocupadas >= CAPACIDADE_PARTIDA
  return (
    <>
      {status !== 'confirmado' && (
        <button
          type="button"
          disabled={processando || !podeConf}
          onClick={() => onAtualizar('confirmado')}
          title={lotado ? 'Vagas esgotadas' : undefined}
          className={`${btn} border-destaque text-destaque`}
        >
          Vou jogar
        </button>
      )}
      {status === 'confirmado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('pendente')}
          className={`${btn} border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300`}
        >
          Desconfirmar
        </button>
      )}
      {status !== 'recusado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('recusado')}
          className={`${btn} border-red-300 dark:border-red-800 text-red-600 dark:text-red-400`}
        >
          Não vou
        </button>
      )}
    </>
  )
}

// Controles do admin (pode mexer em qualquer jogador).
function BotoesAdmin({
  status,
  podeConf,
  processando,
  onAtualizar,
  onRemover,
}: PropsBotoes & { onRemover?: () => void }) {
  const mini =
    'min-h-[30px] min-w-[30px] rounded-md border text-xs font-bold active:scale-95 transition disabled:opacity-30'
  const off = 'border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={processando || (status !== 'confirmado' && !podeConf)}
        onClick={() => onAtualizar('confirmado')}
        title="Confirmar"
        className={`${mini} ${
          status === 'confirmado'
            ? 'border-green-500 text-green-600 dark:text-green-400'
            : off
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
          status === 'pendente'
            ? 'border-destaque text-destaque'
            : off
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
          status === 'recusado'
            ? 'border-red-500 text-red-600 dark:text-red-400'
            : off
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
          className={`${mini} ${off} hover:text-red-600 dark:hover:text-red-400`}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function Confirmacoes({
  partida,
  participantes,
  jogadorLogadoId,
  isAdmin,
  onAtualizar,
}: {
  partida: Partida
  participantes: Participante[]
  jogadorLogadoId: number | null
  isAdmin: boolean
  onAtualizar: () => Promise<void> | void
}) {
  const [processando, setProcessando] = useState<number | null>(null)
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [mostrandoAvulso, setMostrandoAvulso] = useState(false)
  const [todosAtivos, setTodosAtivos] = useState<JogadorLista[]>([])

  const closesAt = partida.confirmacao_closes_at
  const agora = new Date()
  const prazoPassou = !!closesAt && agora.getTime() >= new Date(closesAt).getTime()
  const ocupadas = vagasOcupadas(participantes, closesAt, agora)
  const livres = Math.max(0, CAPACIDADE_PARTIDA - ocupadas)

  const ordenados = [...participantes].sort((a, b) => {
    const peso = (s: StatusConfirmacao) =>
      s === 'confirmado' ? 0 : s === 'pendente' ? 1 : 2
    return (
      peso(a.status_confirmacao) - peso(b.status_confirmacao) ||
      (a.nome ?? '').localeCompare(b.nome ?? '')
    )
  })

  async function atualizar(jogadorId: number, alvo: StatusConfirmacao) {
    setErroLocal(null)
    setProcessando(jogadorId)
    try {
      const ehSelf = jogadorId === jogadorLogadoId
      const ok =
        !ehSelf && isAdmin && jogadorLogadoId != null
          ? await adminDefinirConfirmacao(partida.id, jogadorId, alvo, jogadorLogadoId)
          : await confirmarPresenca(partida.id, jogadorId, alvo)
      if (!ok) {
        setErroLocal('Não foi possível atualizar — confira as vagas disponíveis.')
      } else {
        await onAtualizar()
      }
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function remover(jogadorId: number) {
    setErroLocal(null)
    setProcessando(jogadorId)
    try {
      await removerParticipanteDraft(partida.id, jogadorId)
      await onAtualizar()
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function adicionar(jogadorId: number) {
    setErroLocal(null)
    setProcessando(jogadorId)
    try {
      const ok = await adicionarParticipante(partida.id, jogadorId)
      if (!ok) {
        setErroLocal('Não foi possível adicionar — pode não haver vaga.')
      } else {
        setMostrandoAvulso(false)
        await onAtualizar()
      }
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function abrirAvulso() {
    setMostrandoAvulso((v) => !v)
    if (todosAtivos.length === 0) {
      try {
        setTodosAtivos(await listarJogadoresAtivos())
      } catch {
        /* ignora erro de listagem */
      }
    }
  }

  const idsNoElenco = new Set(participantes.map((p) => p.jogador_id))
  const candidatosAvulso = todosAtivos.filter((j) => !idsNoElenco.has(j.id))

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          Confirmações
        </h3>
        <span className="text-xs font-medium text-destaque">
          {ocupadas}/{CAPACIDADE_PARTIDA} vagas
        </span>
      </div>

      {closesAt && (
        <p className="px-3 pt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {prazoPassou
            ? 'Prazo encerrado — as vagas remanescentes estão liberadas (primeiro a confirmar leva).'
            : `Reservas liberadas ${formatarFechamento(closesAt)}.`}
        </p>
      )}

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {ordenados.map((p) => {
          const ehSelf = p.jogador_id === jogadorLogadoId
          const podeConf = podeConfirmar(p, 'confirmado', participantes, closesAt, agora)
          return (
            <div
              key={p.jogador_id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar nome={p.nome ?? ""} size="xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {p.nome ?? `#${p.jogador_id}`}
                    {ehSelf && (
                      <span className="ml-1 text-[10px] text-neutral-400">(você)</span>
                    )}
                  </p>
                  <BadgeStatus status={p.status_confirmacao} />
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
          )
        })}
        {ordenados.length === 0 && (
          <div className="px-3 py-3 text-xs text-neutral-400">Nenhum convite ainda.</div>
        )}
      </div>

      {isAdmin && livres > 0 && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={abrirAvulso}
            className="w-full px-3 py-2 text-xs font-medium text-destaque"
          >
            {mostrandoAvulso
              ? 'Fechar'
              : `+ Avulso (${livres} vaga${livres > 1 ? 's' : ''})`}
          </button>
          {mostrandoAvulso && (
            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
              {candidatosAvulso.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={processando !== null}
                  onClick={() => adicionar(j.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 active:scale-[.99]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar nome={j.nome} size="xs" />
                    <span className="truncate">{j.nome}</span>
                  </span>
                  <span className="text-[10px] uppercase text-neutral-400">
                    {POSICOES[j.posicao]}
                  </span>
                </button>
              ))}
              {candidatosAvulso.length === 0 && (
                <div className="px-3 py-3 text-xs text-neutral-400">
                  Nenhum jogador disponível.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {erroLocal && (
        <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-neutral-200 dark:border-neutral-800">
          {erroLocal}
        </p>
      )}
    </section>
  )
}
