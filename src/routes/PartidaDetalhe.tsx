import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'
import { useJogadorLogado } from '../hooks/useJogadorLogado'
import { TIMES, POSICOES, type TimeId } from '../lib/times'
import {
  carregarPartida,
  carregarPlacar,
  carregarParticipantes,
  carregarNotas,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
} from '../lib/partidas'
import { Carregando, MensagemEstado } from '../components/Estado'
import { formatarDataCompleta, formatarDataMobile, formatarFechamento } from '../lib/formatacao'

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
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)

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

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function publicar() {
    if (!partida) return
    setPublicando(true)
    const votingClosesAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('partidas')
      .update({ status: 'published', voting_closes_at: votingClosesAt })
      .eq('id', partida.id)
    setPublicando(false)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  if (carregando) return <Carregando>Carregando partida</Carregando>
  if (erro) return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>
  if (!partida)
    return <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">Partida não encontrada.</MensagemEstado>

  const statusLabel: Record<Partida['status'], string> = {
    draft: 'Rascunho',
    published: 'Votação aberta',
    closed: 'Encerrada',
  }
  const statusCor: Record<Partida['status'], string> = {
    draft: 'text-neutral-500',
    published: 'text-[var(--cor-destaque)]',
    closed: 'text-green-600 dark:text-green-400',
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
        <p className={`text-xs font-medium ${statusCor[partida.status]}`}>
          {statusLabel[partida.status]}
          {partida.status === 'published' && partida.voting_closes_at && (
            <> — fecha {formatarFechamento(partida.voting_closes_at)}</>
          )}
        </p>
      </div>

      {/* Placar central */}
      {placar && (
        <div className="flex items-stretch rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <div
            className="flex-1 py-4 text-center text-sm font-medium"
            style={{ backgroundColor: TIMES.a.cor, color: '#f9fafb' }}
          >
            Time Preto
          </div>
          <div className="px-6 py-4 flex items-center bg-neutral-50 dark:bg-neutral-900">
            <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {placar.gols_time_a} × {placar.gols_time_b}
            </span>
          </div>
          <div
            className="flex-1 py-4 text-center text-sm font-medium border-l border-neutral-200 dark:border-neutral-800"
            style={{ backgroundColor: TIMES.b.cor, color: '#111827' }}
          >
            Time Branco
          </div>
        </div>
      )}

      {/* Craque da partida (só quando closed) */}
      {partida.status === 'closed' && craque && (
        <div className="rounded-lg border border-[var(--cor-destaque)] bg-[var(--cor-destaque)]/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-[var(--cor-destaque)] font-semibold">
            ⭐ Craque da partida
          </p>
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
                  <span className="text-neutral-900 dark:text-neutral-100">
                    {n.is_craque ? '⭐ ' : ''}
                    {n.nome}
                  </span>
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
                className="px-3 py-2 text-xs font-semibold"
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
                    className="px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {p.nome}
                      </span>
                      <span className="text-[10px] uppercase text-neutral-400">
                        {POSICOES[p.posicao]}
                      </span>
                    </div>
                    {(p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0) && (
                      <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {p.gols > 0 && <>⚽ {p.gols} </>}
                        {p.assistencias > 0 && <>🅰️ {p.assistencias} </>}
                        {p.gols_contra > 0 && <>GC {p.gols_contra}</>}
                      </div>
                    )}
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

      {/* Ações: publicar (admin/draft) ou votar (published) */}
      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Ao publicar, a votação abre por 24h e a partida entra no ranking.
          </p>
          <button
            onClick={publicar}
            disabled={publicando}
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {publicando ? 'Publicando…' : 'Publicar partida'}
          </button>
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center text-xs text-[var(--cor-destaque)] underline"
          >
            Editar times/gols
          </Link>
        </div>
      )}

      {votacaoAberta && jaEhParticipante && (
        <div className="space-y-2">
          {jaVotou ? (
            <p className="text-center text-xs text-green-600 dark:text-green-400">
              ✓ Você já votou. Pode editar até a votação fechar.
            </p>
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

      {partida.status === 'published' && !votacaoAberta && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          Votação encerrada — aguardando resultado.
        </p>
      )}
    </div>
  )
}
