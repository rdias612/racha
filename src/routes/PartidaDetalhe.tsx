import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'

interface Partida {
  id: number
  data_jogo: string
  status: 'draft' | 'published' | 'closed'
  voting_closes_at: string | null
}

interface Placar {
  partida_id: number
  gols_time_a: number
  gols_time_b: number
  vencedor: string
}

export function PartidaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useAdmin()
  const [partida, setPartida] = useState<Partida | null>(null)
  const [placar, setPlacar] = useState<Placar | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)

  async function carregar() {
    if (!id) return
    setCarregando(true)
    const { data: p, error: ep } = await supabase
      .from('partidas')
      .select('id, data_jogo, status, voting_closes_at')
      .eq('id', id)
      .maybeSingle()

    if (ep) {
      setErro(ep.message)
      setCarregando(false)
      return
    }
    setPartida(p)

    const { data: pl } = await supabase
      .from('partida_placar')
      .select('partida_id, gols_time_a, gols_time_b, vencedor')
      .eq('partida_id', id)
      .maybeSingle()
    setPlacar(pl)
    setCarregando(false)
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

  if (carregando) return <div className="p-4 text-sm text-neutral-500">Carregando…</div>
  if (erro) return <div className="p-4 text-sm text-red-600">{erro}</div>
  if (!partida) return <div className="p-4 text-sm text-neutral-500">Partida não encontrada.</div>

  const dataFmt = new Date(partida.data_jogo).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Partida #{partida.id}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{dataFmt}</p>
        <p className={`text-xs font-medium ${statusCor[partida.status]}`}>
          {statusLabel[partida.status]}
        </p>
      </div>

      {placar && (
        <div className="flex items-center justify-center gap-4 rounded-lg border border-neutral-200 dark:border-neutral-800 py-4">
          <span className="text-sm">Time Preto</span>
          <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {placar.gols_time_a} × {placar.gols_time_b}
          </span>
          <span className="text-sm">Time Branco</span>
        </div>
      )}

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
        </div>
      )}

      {partida.status === 'published' && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Votação fecha em:{' '}
          {partida.voting_closes_at
            ? new Date(partida.voting_closes_at).toLocaleString('pt-BR')
            : '—'}
        </p>
      )}

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Detalhes completos (gols por jogador, craque) chegam na Etapa 4.
      </p>
    </div>
  )
}
