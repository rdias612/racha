import { useParams, Link } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'
import { Navigate } from 'react-router-dom'

export function PartidaEditar() {
  const isAdmin = useAdmin()
  const { id } = useParams<{ id: string }>()

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <Link
        to={`/partida/${id}`}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </Link>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Editar partida #{id}
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Edição de times e gols durante a votação aberta — implementação detalhada
        entra em uma próxima iteração.
      </p>
    </div>
  )
}
