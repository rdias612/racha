import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'
import { useJogadorLogado } from '../hooks/useJogadorLogado'
import { TIMES, POSICOES, type TimeId } from '../lib/times'
import {
  abrirPartida,
  carregarPartida,
  carregarPlacar,
  carregarParticipantes,
  carregarNotas,
  descartarVotos,
  STATUS_COR,
  STATUS_LABEL,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
} from '../lib/partidas'
import { Carregando, MensagemEstado } from '../components/Estado'
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
    } catch (e: any) {
      setErro(e.message ?? String(e))
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
    } catch (e: any) {
      setConfirmandoDescarte(false)
      setErro(e.message ?? String(e))
    } finally {
      setDescartando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (carregando) return <Carregando>Carregando partida</Carregando>
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
    } catch (e: any) {
      setErro(e.message ?? String(e))
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
  const isRandom =
    !!jogadorLogado &&
    jogadorLogado.username.toLowerCase().startsWith("random")

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
        <div className="rounded-lg border border-[var(--cor-destaque)] bg-[var(--cor-destaque)]/10 px-4 py-3 text-center flex flex-col items-center gap-1.5">
          <p className="text-xs uppercase tracking-wide text-[var(--cor-destaque)] font-semibold">
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

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Abra a partida para registrar os gols no campo. Se o jogo já acabou, lance o resultado na mão.
          </p>
          <button
            type="button"
            onClick={confirmarAbrir}
            disabled={abrindo}
            className="block w-full text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {abrindo ? 'Abrindo…' : 'Abrir partida'}
          </button>
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300"
          >
            Lançar resultado sem acompanhar
          </Link>
        </div>
      )}

      {partida.status === 'live' && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/ao-vivo`}
            className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white"
          >
            {isAdmin ? 'Registrar eventos' : 'Acompanhar ao vivo'}
          </Link>
        </div>
      )}

      {partida.status === 'published' && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300"
          >
            Editar resultado
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
                  className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white"
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
              className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white"
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
