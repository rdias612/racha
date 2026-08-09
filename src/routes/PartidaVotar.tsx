import { Link, Navigate, useParams } from 'react-router-dom'
import { useJogadorLogado } from '../hooks/useJogadorLogado'

export function PartidaVotar() {
  const { id } = useParams<{ id: string }>()
  const jogador = useJogadorLogado()

  if (!jogador) return <Navigate to="/login" replace />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <Link
        to={`/partida/${id}`}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </Link>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Votar — partida #{id}
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Tela de votação 0–10 — implementação na Etapa 6.
      </p>
    </div>
  )
}
