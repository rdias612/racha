import {
  NavLink,
  Outlet,
  useNavigate,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { useState } from "react";
import { useSessao } from "../context/SessaoContext";
import { useTema } from "../lib/tema";
import { BannerLembrete } from "../components/BannerLembrete";

function itemClasse({ isActive }: { isActive: boolean }) {
  return `flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm whitespace-nowrap ${
    isActive
      ? "text-[var(--cor-destaque)]"
      : "text-neutral-500 dark:text-neutral-400"
  }`;
}

export function Layout() {
  const { jogador, logout } = useSessao();
  const { tema, alternar } = useTema();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const rankingAtivo = pathname.startsWith("/ranking");
  const [rankingAberto, setRankingAberto] = useState(rankingAtivo);

  if (!jogador) {
    return <Navigate to="/login" replace />;
  }

  function fazerLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="shrink-0 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            racha-gragoata-cbo
          </h1>
          <div className="flex items-center gap-2">
            {jogador.is_admin && (
              <Link
                to="/jogador/novo"
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                + Jogador
              </Link>
            )}
            <button
              onClick={alternar}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              {tema === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={fazerLogout}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Sair
            </button>
          </div>
        </div>

        <nav
          aria-label="Navegação principal"
          className="mt-3 border-t border-neutral-200 pt-2 dark:border-neutral-800"
        >
          <div className="flex gap-1 overflow-x-auto">
            <NavLink to="/" end className={itemClasse}>
              <span className="text-lg">⚽</span>
              Jogos
            </NavLink>
            <button
              type="button"
              aria-controls="submodulos-ranking"
              aria-expanded={rankingAberto}
              onClick={() => setRankingAberto((aberto) => !aberto)}
              className={itemClasse({ isActive: rankingAtivo })}
            >
              <span>🏆</span>
              Rankings
              <span aria-hidden="true">{rankingAberto ? "▴" : "▾"}</span>
            </button>
            <NavLink to="/perfil" className={itemClasse}>
              <span className="text-lg">👤</span>
              Perfil
            </NavLink>
          </div>

          {rankingAberto && (
            <div
              id="submodulos-ranking"
              className="mt-1 flex gap-1 overflow-x-auto border-l-2 border-[var(--cor-destaque)] pl-1"
            >
              <NavLink to="/ranking/pontos" className={itemClasse}>
                Pontuação
              </NavLink>
              <NavLink to="/ranking/gols" className={itemClasse}>
                Gols
              </NavLink>
              <NavLink to="/ranking/assistencias" className={itemClasse}>
                Assistências
              </NavLink>
              <NavLink to="/ranking/gols-contra" className={itemClasse}>
                Gols contra
              </NavLink>
            </div>
          )}
        </nav>
      </header>

      <BannerLembrete />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
