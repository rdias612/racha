import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
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
  Sun,
  Moon,
  Bell,
} from 'lucide-react';
import { useSessao } from '../context/SessaoContext';
import { useAdmin } from '../hooks/useAdmin';
import { useTema } from '../lib/tema';
import { Logo } from '../components/Logo';
import { BannerLembrete } from '../components/BannerLembrete';
import {
  CarregandoGeral,
  SkeletonComparador,
  SkeletonDetalhe,
  SkeletonEstatisticas,
  SkeletonGestao,
  SkeletonJogos,
  SkeletonNotificacoes,
  SkeletonPerfil,
  SkeletonRanking,
  SkeletonResumo,
} from '../components/Skeletons';
import { preCarregarRota } from '../lib/rotas';

/**
 * Skeleton de fallback do Suspense do Outlet por prefixo de pathname (CLS = 0
 * durante o carregamento do chunk lazy da rota destino). Espelha as associações
 * já usadas pelas próprias telas; rotas sem skeleton específico (fluxos focados
 * de partida, formulários e painel financeiro) caem no CarregandoGeral padrão.
 */
const SKELETONS_POR_ROTA: Array<{ padrao: RegExp; Skeleton: ComponentType }> = [
  { padrao: /^\/$/, Skeleton: SkeletonResumo },
  { padrao: /^\/jogos/, Skeleton: SkeletonJogos },
  { padrao: /^\/ranking/, Skeleton: SkeletonRanking },
  { padrao: /^\/estatisticas\/comparar/, Skeleton: SkeletonComparador },
  { padrao: /^\/estatisticas/, Skeleton: SkeletonEstatisticas },
  { padrao: /^\/perfil/, Skeleton: SkeletonPerfil },
  { padrao: /^\/partida\/\d+\/?$/, Skeleton: SkeletonDetalhe },
  { padrao: /^\/gestao-jogadores/, Skeleton: SkeletonGestao },
  { padrao: /^\/gestao-goleiros/, Skeleton: SkeletonGestao },
  { padrao: /^\/notificacoes/, Skeleton: SkeletonNotificacoes },
];

function obterSkeletonRota(pathname: string): ComponentType {
  const entrada = SKELETONS_POR_ROTA.find((rota) => rota.padrao.test(pathname));
  return entrada?.Skeleton ?? CarregandoGeral;
}

/** Handlers de prefetch de chunk da TabBar: toque, hover e foco (teclado). */
function preCarregarAoInteragir(destino: string) {
  return {
    onTouchStart: () => preCarregarRota(destino),
    onMouseEnter: () => preCarregarRota(destino),
    onFocus: () => preCarregarRota(destino),
  };
}

const preCarregarAbaResumo = preCarregarAoInteragir('/');
const preCarregarAbaJogos = preCarregarAoInteragir('/jogos');
const preCarregarAbaRanking = preCarregarAoInteragir('/ranking/pontos');
const preCarregarAbaEstatisticas = preCarregarAoInteragir('/estatisticas/jogador');
const preCarregarAbaPerfil = preCarregarAoInteragir('/perfil');

export function Layout() {
  const { jogador } = useSessao();
  const isAdmin = useAdmin();
  const { tema, alternar: alternarTema } = useTema();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const rankingAtivo = pathname.startsWith('/ranking');
  const estatisticasAtivo = pathname.startsWith('/estatisticas');
  const isFluxoFocado =
    /^\/partida\/(nova(\/times|\/confirma)?|\d+\/(votar|editar|ao-vivo|times))/.test(pathname);
  // Fallback do boundary do Outlet: skeleton da rota DESTINO (o pathname já
  // aponta para a nova rota no instante em que o chunk lazy suspende).
  const SkeletonRota = obterSkeletonRota(pathname);

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
            <button
              type="button"
              onClick={alternarTema}
              aria-label={
                tema === 'dark'
                  ? 'Mudar para modo claro (papel de súmula)'
                  : 'Mudar para modo escuro (refletor)'
              }
              title={tema === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-borda bg-superficie p-2 text-giz shadow-carimbo hover:bg-superficie-2 hover:text-destaque transition-fast active:translate-y-px"
            >
              {tema === 'dark' ? (
                <Sun className="size-4 text-destaque" />
              ) : (
                <Moon className="size-4 text-destaque" />
              )}
            </button>

            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAberto((prev) => !prev)}
                  aria-expanded={menuAberto}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-borda bg-superficie px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-giz shadow-carimbo hover:bg-superficie-2 transition-fast"
                >
                  <span className="font-display tracking-wider font-bold">ADMIN</span>
                  <ChevronDown
                    className={`size-3.5 text-destaque transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`}
                  />
                </button>

                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-[4px] border border-borda bg-superficie p-1.5 shadow-carimbo">
                      <Link
                        to="/gestao-jogadores"
                        onClick={() => setMenuAberto(false)}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-[3px] px-3 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition-fast"
                      >
                        <Users className="size-4 text-destaque shrink-0" />
                        <span className="font-display font-bold uppercase tracking-wider text-xs">
                          Gestão de Jogadores
                        </span>
                      </Link>

                      <Link
                        to="/jogador/novo"
                        onClick={() => setMenuAberto(false)}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-[3px] px-3 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition-fast"
                      >
                        <UserPlus className="size-4 text-destaque shrink-0" />
                        <span className="font-display font-bold uppercase tracking-wider text-xs">
                          + Novo Jogador
                        </span>
                      </Link>

                      <Link
                        to="/administrador"
                        onClick={() => setMenuAberto(false)}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-[3px] px-3 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition-fast"
                      >
                        <Wallet className="size-4 text-destaque shrink-0" />
                        <span className="font-display font-bold uppercase tracking-wider text-xs">
                          Financeiro & Súmula
                        </span>
                      </Link>

                      <Link
                        to="/notificacoes"
                        onClick={() => setMenuAberto(false)}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-[3px] px-3 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque transition-fast"
                      >
                        <Bell className="size-4 text-destaque shrink-0" />
                        <span className="font-display font-bold uppercase tracking-wider text-xs">
                          Notificações Push
                        </span>
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

      <main
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${isFluxoFocado ? 'pb-24' : 'pb-16'}`}
      >
        {/* Boundary próprio do Outlet: Header e TabBar permanecem montados
            enquanto o chunk lazy da rota destino carrega (sem piscar o shell). */}
        <Suspense fallback={<SkeletonRota />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Nav Inferior com indicador de barra âmbar no item ativo (oculta em fluxos focados) */}
      {!isFluxoFocado && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie/95 backdrop-blur"
        >
          <div
            className="mx-auto flex max-w-2xl items-stretch justify-around"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <NavLink
              to="/"
              end
              aria-current={pathname === '/' ? 'page' : undefined}
              {...preCarregarAbaResumo}
              className={({ isActive }) =>
                `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                  isActive
                    ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                    : 'text-giz-fraco hover:text-giz'
                }`
              }
            >
              <Home className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-display uppercase tracking-wider">Resumo</span>
            </NavLink>
            <NavLink
              to="/jogos"
              aria-current={pathname === '/jogos' ? 'page' : undefined}
              {...preCarregarAbaJogos}
              className={({ isActive }) =>
                `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                  isActive
                    ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                    : 'text-giz-fraco hover:text-giz'
                }`
              }
            >
              <Shield className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-display uppercase tracking-wider">Jogos</span>
            </NavLink>
            <NavLink
              to="/ranking/pontos"
              aria-current={rankingAtivo ? 'page' : undefined}
              {...preCarregarAbaRanking}
              className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                rankingAtivo
                  ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                  : 'text-giz-fraco hover:text-giz'
              }`}
            >
              <Medal className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-display uppercase tracking-wider">Ranking</span>
            </NavLink>
            <NavLink
              to="/estatisticas/jogador"
              aria-current={estatisticasAtivo ? 'page' : undefined}
              {...preCarregarAbaEstatisticas}
              className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                estatisticasAtivo
                  ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                  : 'text-giz-fraco hover:text-giz'
              }`}
            >
              <TrendingUp className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-display uppercase tracking-wider">
                Estatísticas
              </span>
            </NavLink>
            <NavLink
              to="/perfil"
              aria-current={pathname === '/perfil' ? 'page' : undefined}
              {...preCarregarAbaPerfil}
              className={({ isActive }) =>
                `relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition ${
                  isActive
                    ? "text-destaque font-bold after:content-[''] after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:bg-destaque"
                    : 'text-giz-fraco hover:text-giz'
                }`
              }
            >
              <User className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-display uppercase tracking-wider">Perfil</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}
