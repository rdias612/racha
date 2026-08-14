import { useState } from "react";
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
  Wallet,
  ChevronDown,
  Users,
  WifiOff,
} from "lucide-react";
import { useSessao } from "../context/SessaoContext";
import { useAdmin } from "../hooks/useAdmin";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useTema } from "../lib/tema";
import { Logo } from "../components/Logo";
import { BannerLembrete } from "../components/BannerLembrete";


export function Layout() {
  const { jogador } = useSessao();
  const isAdmin = useAdmin();
  const isOnline = useOnlineStatus();
  const { tema, alternar } = useTema();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);

  const rankingAtivo = pathname.startsWith("/ranking");
  const estatisticasAtivo = pathname.startsWith("/estatisticas");

  if (!jogador) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-1.5 bg-amber-500/90 px-3 py-1.5 text-center text-xs font-medium text-amber-950 dark:bg-amber-600 dark:text-white shrink-0"
        >
          <WifiOff className="size-3.5" aria-hidden="true" />
          <span>Você está offline. Algumas informações podem estar desatualizadas.</span>
        </div>
      )}

      <header className="shrink-0 border-b border-neutral-200 px-3 py-2.5 sm:px-4 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-x-4">
          <Link to="/" className="hover:opacity-90 transition">
            <Logo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alternar}
              aria-label={tema === "dark" ? "Modo Claro" : "Modo Escuro"}
              title={tema === "dark" ? "Modo Claro" : "Modo Escuro"}
              className="inline-flex items-center justify-center p-1.5 rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-xs hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 transition"
            >
              {tema === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-neutral-600 dark:text-neutral-400" />
              )}
            </button>

            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAberto((prev) => !prev)}
                  aria-expanded={menuAberto}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 transition"
                >
                  <span>Admin</span>
                  <ChevronDown className={`size-3.5 transition-transform ${menuAberto ? "rotate-180" : ""}`} />
                </button>

                {menuAberto && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuAberto(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                      <Link
                        to="/gestao-jogadores"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <Users className="size-3.5 text-[var(--cor-primaria)]" />
                        <span>Gestão de Jogadores</span>
                      </Link>

                      <Link
                        to="/jogador/novo"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <UserPlus className="size-3.5 text-[var(--cor-primaria)]" />
                        <span>+ Novo Jogador</span>
                      </Link>

                      <Link
                        to="/administrador"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <Wallet className="size-3.5 text-[var(--cor-primaria)]" />
                        <span>Financeiro</span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <BannerLembrete />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-28">
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
