import { NavLink, Outlet, useNavigate, Navigate, Link } from 'react-router-dom'
import { useSessao } from '../context/SessaoContext'
import { useTema } from '../lib/tema'

function itemClasse({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center justify-center flex-1 py-2 text-xs ${
    isActive
      ? 'text-[var(--cor-destaque)]'
      : 'text-neutral-500 dark:text-neutral-400'
  }`
}

export function Layout() {
  const { jogador, logout } = useSessao()
  const { tema, alternar } = useTema()
  const navigate = useNavigate()

  if (!jogador) {
    return <Navigate to="/login" replace />
  }

  function fazerLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          racha-gragoata-cbo
        </h1>
        <div className="flex items-center gap-2">
          {jogador.is_admin && (
            <Link
              to="/jogador/novo"
              className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
            >
              + Jogador
            </Link>
          )}
          <button
            onClick={alternar}
            className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          >
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={fazerLogout}
            className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="flex border-t border-neutral-200 dark:border-neutral-800">
        <NavLink to="/" end className={itemClasse}>
          <span className="text-lg">⚽</span>
          Jogos
        </NavLink>
        <NavLink to="/ranking" className={itemClasse}>
          <span className="text-lg">🏆</span>
          Ranking
        </NavLink>
        <NavLink to="/perfil" className={itemClasse}>
          <span className="text-lg">👤</span>
          Perfil
        </NavLink>
      </nav>
    </div>
  )
}
