import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useJogadorLogado } from '../hooks/useJogadorLogado'

interface PartidaAberta {
  id: number
  voting_closes_at: string
}

function formatarRestante(ms: number): string {
  if (ms <= 0) return 'encerrando'
  const h = Math.floor(ms / (1000 * 60 * 60))
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export function BannerLembrete() {
  const jogador = useJogadorLogado()
  const [pendentes, setPendentes] = useState<PartidaAberta[]>([])
  const [agora, setAgora] = useState(Date.now())

  const jogadorId = jogador?.id

  const verificar = useCallback(async () => {
    if (!jogadorId) {
      setPendentes([])
      return
    }

    // 1. Busca partidas published com votação aberta
    const { data: partidasAbertas } = await supabase
      .from('partidas')
      .select('id, voting_closes_at')
      .eq('status', 'published')
      .gt('voting_closes_at', new Date().toISOString())

    if (!partidasAbertas || partidasAbertas.length === 0) {
      setPendentes([])
      return
    }

    const idsPartidas = partidasAbertas.map((p) => p.id)

    // 2. Busca partidas em que o jogador efetivamente participou
    const { data: participacoes } = await supabase
      .from('partidas_participantes')
      .select('partida_id')
      .eq('jogador_id', jogadorId)
      .in('partida_id', idsPartidas)

    if (!participacoes || participacoes.length === 0) {
      setPendentes([])
      return
    }

    const idsParticipou = new Set(participacoes.map((p) => p.partida_id))
    const partidasDoJogador = partidasAbertas.filter((p) =>
      idsParticipou.has(p.id)
    )

    if (partidasDoJogador.length === 0) {
      setPendentes([])
      return
    }

    // 3. Filtra as partidas onde o jogador já votou
    const { data: votados } = await supabase
      .from('votes')
      .select('partida_id')
      .eq('voter_id', jogadorId)
      .in(
        'partida_id',
        partidasDoJogador.map((p) => p.id)
      )

    const idsVotados = new Set((votados ?? []).map((v) => v.partida_id))
    const pendentesLista = partidasDoJogador.filter(
      (p) => !idsVotados.has(p.id)
    )
    setPendentes(pendentesLista)
  }, [jogadorId])

  // Recarrega a cada 1min sem dependência cíclica
  useEffect(() => {
    verificar()
    const intervalo = setInterval(verificar, 60_000)
    return () => clearInterval(intervalo)
  }, [verificar])

  // Tick a cada 1min para atualizar o countdown
  useEffect(() => {
    if (pendentes.length === 0) return
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [pendentes.length])

  if (pendentes.length === 0) return null

  return (
    <div className="border-b border-[var(--cor-destaque)]/30 bg-[var(--cor-destaque)]/10 px-3 py-2 sm:px-4 space-y-1">
      {pendentes.map((p) => {
        const restante = new Date(p.voting_closes_at).getTime() - agora
        return (
          <Link
            key={p.id}
            to={`/partida/${p.id}/votar`}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-neutral-800 dark:text-neutral-200">
              ⚡ Votação aberta — partida #{p.id}
            </span>
            <span className="font-medium text-[var(--cor-destaque)]">
              fecha em {formatarRestante(restante)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
