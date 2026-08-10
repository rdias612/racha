import { NavLink, Outlet, useNavigate, Navigate, Link } from "react-router-dom";
import { useSessao } from "../context/SessaoContext";
import { useTema } from "../lib/tema";
import { BannerLembrete } from "../components/BannerLembrete";

function itemClasse({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 rounded px-3 py-2 text-sm ${
    isActive
      ? "text-[var(--cor-destaque)]"
      : "text-neutral-500 dark:text-neutral-400"
  }`;
}

export function Layout() {
  const { jogador, logout } = useSessao();
  const { tema, alternar } = useTema();
  const navigate = useNavigate();

  if (!jogador) {
    return <Navigate to="/login" replace />;
  }

  function fazerLogout() {
    logout();
    navigate("/login", { replace: true });
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
            {tema === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={fazerLogout}
            className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          >
            Sair
          </button>
        </div>
      </header>

      <BannerLembrete />

      <div className="flex flex-1 min-h-0">
        <aside className="w-52 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-3">
          <nav className="flex flex-col gap-1">
            <NavLink to="/" end className={itemClasse}>
              <span className="text-lg">⚽</span>
              Jogos
            </NavLink>
            <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Ranking
            </div>
            <NavLink to="/ranking/gols" className={itemClasse}>
              <span>⚽</span>
              Gols
            </NavLink>
            <NavLink to="/ranking/assistencias" className={itemClasse}>
              <span>🅰️</span>
              Assistências
            </NavLink>
            <NavLink to="/ranking/gols-contra" className={itemClasse}>
              <span>🔄</span>
              Gols contra
            </NavLink>
            <NavLink to="/perfil" className={itemClasse}>
              <span className="text-lg">👤</span>
              Perfil
            </NavLink>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
