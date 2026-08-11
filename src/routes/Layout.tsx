import {
  NavLink,
  Outlet,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Home,
  Shield,
  Medal,
  TrendingUp,
  User,
  Sun,
  Moon,
  UserPlus,
} from "lucide-react";
import { useSessao } from "../context/SessaoContext";
import { useTema } from "../lib/tema";
import { BannerLembrete } from "../components/BannerLembrete";

export function Layout() {
  const { jogador } = useSessao();
  const { tema, alternar } = useTema();
  const { pathname } = useLocation();
  const rankingAtivo = pathname.startsWith("/ranking");
  const estatisticasAtivo = pathname.startsWith("/estatisticas");

  if (!jogador) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="shrink-0 border-b border-neutral-200 px-3 py-3 sm:px-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Racha Gragoatá
          </h1>
          <div className="flex items-center gap-2">
            {jogador.is_admin && (
              <Link
                to="/jogador/novo"
                className="inline-flex items-center gap-1.5 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                <UserPlus className="size-3.5" />
                <span>+ Jogador</span>
              </Link>
            )}
            <button
              onClick={alternar}
              aria-label="Alternar tema"
              className="inline-flex items-center justify-center rounded border border-neutral-300 p-1.5 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              {tema === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-neutral-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      <BannerLembrete />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-neutral-50/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          <NavLink
            to="/"
            end
            aria-current={pathname === "/" ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 ${
              pathname === "/"
                ? "text-(--cor-destaque) font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <Home className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Resumo</span>
          </NavLink>
          <NavLink
            to="/jogos"
            aria-current={pathname === "/jogos" ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 ${
              pathname === "/jogos"
                ? "text-(--cor-destaque) font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <Shield className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Jogos</span>
          </NavLink>
          <NavLink
            to="/ranking/pontos"
            aria-current={rankingAtivo ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 ${
              rankingAtivo
                ? "text-(--cor-destaque) font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <Medal className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Ranking</span>
          </NavLink>
          <NavLink
            to="/estatisticas/jogador"
            aria-current={estatisticasAtivo ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 ${
              estatisticasAtivo
                ? "text-(--cor-destaque) font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <TrendingUp className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Estatísticas</span>
          </NavLink>
          <NavLink
            to="/perfil"
            aria-current={pathname === "/perfil" ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 ${
              pathname === "/perfil"
                ? "text-(--cor-destaque) font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <User className="size-5" aria-hidden="true" />
            <span className="text-[10px]">Perfil</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
