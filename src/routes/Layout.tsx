import { useEffect, useState } from "react";
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
  UserPlus,
  Wallet,
  ChevronDown,
  Users,
  WifiOff,
} from "lucide-react";
import { useSessao } from "../context/SessaoContext";
import { useAdmin } from "../hooks/useAdmin";
import { Logo } from "../components/Logo";
import { BannerLembrete } from "../components/BannerLembrete";

export function Layout() {
  const { jogador } = useSessao();
  const isAdmin = useAdmin();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const rankingAtivo = pathname.startsWith("/ranking");
  const estatisticasAtivo = pathname.startsWith("/estatisticas");

  if (!jogador) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-full flex flex-col bg-fundo text-giz">
      {/* Banner Global Offline */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 bg-perigo px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-xs"
        >
          <WifiOff className="size-3.5 shrink-0" />
          <span>Modo offline — exibindo dados locais salvos</span>
        </div>
      )}

      {/* Header Sticky com Súmula Wordmark */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-borda bg-fundo/95 backdrop-blur px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-x-4 max-w-2xl mx-auto">
          <Link to="/" className="hover:opacity-90 transition active:scale-[0.98]">
            <Logo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAberto((prev) => !prev)}
                  aria-expanded={menuAberto}
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-borda bg-superficie px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-giz shadow-carimbo hover:bg-superficie-2 transition"
                >
                  <span className="font-display tracking-wider">ADMIN</span>
                  <ChevronDown className={`size-3.5 text-destaque transition-transform ${menuAberto ? "rotate-180" : ""}`} />
                </button>

                {menuAberto && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuAberto(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-[4px] border border-borda bg-superficie p-1.5 shadow-carimbo">
                      <Link
                        to="/gestao-jogadores"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition"
                      >
                        <Users className="size-3.5 text-destaque" />
                        <span>Gestão de Jogadores</span>
                      </Link>

                      <Link
                        to="/jogador/novo"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition"
                      >
                        <UserPlus className="size-3.5 text-destaque" />
                        <span>+ Novo Jogador</span>
                      </Link>

                      <Link
                        to="/administrador"
                        onClick={() => setMenuAberto(false)}
                        className="flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition"
                      >
                        <Wallet className="size-3.5 text-destaque" />
                        <span>Financeiro & Súmula</span>
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

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Nav Inferior com indicador de barra âmbar no item ativo */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie/95 backdrop-blur"
      >
        <div
          className="mx-auto flex max-w-2xl items-stretch justify-around"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <NavLink
            to="/"
            end
            aria-current={pathname === "/" ? "page" : undefined}
            className={({ isActive }) =>
              `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                isActive
                  ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                  : "text-giz-fraco hover:text-giz"
              }`
            }
          >
            <Home className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-display uppercase tracking-wider">Resumo</span>
          </NavLink>
          <NavLink
            to="/jogos"
            aria-current={pathname === "/jogos" ? "page" : undefined}
            className={({ isActive }) =>
              `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                isActive
                  ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                  : "text-giz-fraco hover:text-giz"
              }`
            }
          >
            <Shield className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-display uppercase tracking-wider">Jogos</span>
          </NavLink>
          <NavLink
            to="/ranking/pontos"
            aria-current={rankingAtivo ? "page" : undefined}
            className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
              rankingAtivo
                ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                : "text-giz-fraco hover:text-giz"
            }`}
          >
            <Medal className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-display uppercase tracking-wider">Ranking</span>
          </NavLink>
          <NavLink
            to="/estatisticas/jogador"
            aria-current={estatisticasAtivo ? "page" : undefined}
            className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
              estatisticasAtivo
                ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                : "text-giz-fraco hover:text-giz"
            }`}
          >
            <TrendingUp className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-display uppercase tracking-wider">Estatísticas</span>
          </NavLink>
          <NavLink
            to="/perfil"
            aria-current={pathname === "/perfil" ? "page" : undefined}
            className={({ isActive }) =>
              `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                isActive
                  ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                  : "text-giz-fraco hover:text-giz"
              }`
            }
          >
            <User className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-display uppercase tracking-wider">Perfil</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
