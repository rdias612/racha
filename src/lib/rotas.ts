/**
 * Fonte única das rotas lazy (code splitting) e do prefetch de chunks.
 *
 * - Todos os specifiers `import('../routes/X')` do app vivem AQUI. É proibido
 *   duplicá-los em outros arquivos: o `lazy()` e o `preCarregarRota()` devem
 *   compartilhar o mesmo carregador para que o bunder/navegador cacheie uma
 *   única promise por chunk (prefetch barato e navegação sem round-trip extra).
 * - Consumido por `App.tsx` (declaração de rotas) e `Layout.tsx` (prefetch da
 *   TabBar e fallback do Suspense do Outlet).
 */
import { lazy } from 'react';

// Carregadores das rotas — único ponto do projeto com imports dinâmicos de rotas.
const carregarLogin = () => import('../routes/Login');
const carregarResumo = () => import('../routes/Resumo');
const carregarJogos = () => import('../routes/Jogos');
const carregarRanking = () => import('../routes/Ranking');
const carregarPerfil = () => import('../routes/Perfil');
const carregarEstatisticas = () => import('../routes/Estatisticas');
const carregarEstatisticasRacha = () => import('../routes/EstatisticasRacha');
const carregarComparador = () => import('../routes/Comparador');
const carregarPartidaNova = () => import('../routes/PartidaNova');
const carregarPartidaConfirma = () => import('../routes/PartidaConfirma');
const carregarPartidaNovaTimes = () => import('../routes/PartidaNovaTimes');
const carregarPartidaDetalhe = () => import('../routes/PartidaDetalhe');
const carregarPartidaTimes = () => import('../routes/PartidaTimes');
const carregarPartidaAoVivo = () => import('../routes/PartidaAoVivo');
const carregarPartidaEditar = () => import('../routes/PartidaEditar');
const carregarPartidaVotar = () => import('../routes/PartidaVotar');
const carregarNovoJogador = () => import('../routes/NovoJogador');
const carregarGestaoJogadores = () => import('../routes/GestaoJogadores');
const carregarGestaoGoleiros = () => import('../routes/GestaoGoleiros');
const carregarAdministrador = () => import('../routes/Administrador');
const carregarNotificacoes = () => import('../routes/Notificacoes');

// Componentes lazy consumidos pela declaração de rotas em App.tsx.
export const Login = lazy(() => carregarLogin().then((m) => ({ default: m.Login })));
export const Resumo = lazy(() => carregarResumo().then((m) => ({ default: m.Resumo })));
export const Jogos = lazy(() => carregarJogos().then((m) => ({ default: m.Jogos })));
export const Ranking = lazy(() => carregarRanking().then((m) => ({ default: m.Ranking })));
export const Perfil = lazy(() => carregarPerfil().then((m) => ({ default: m.Perfil })));
export const Estatisticas = lazy(() =>
  carregarEstatisticas().then((m) => ({ default: m.Estatisticas }))
);
export const EstatisticasRacha = lazy(() =>
  carregarEstatisticasRacha().then((m) => ({ default: m.EstatisticasRacha }))
);
export const Comparador = lazy(() => carregarComparador().then((m) => ({ default: m.Comparador })));
export const PartidaNova = lazy(() =>
  carregarPartidaNova().then((m) => ({ default: m.PartidaNova }))
);
export const PartidaConfirma = lazy(() =>
  carregarPartidaConfirma().then((m) => ({ default: m.PartidaConfirma }))
);
export const PartidaNovaTimes = lazy(() =>
  carregarPartidaNovaTimes().then((m) => ({ default: m.PartidaNovaTimes }))
);
export const PartidaDetalhe = lazy(() =>
  carregarPartidaDetalhe().then((m) => ({ default: m.PartidaDetalhe }))
);
export const PartidaTimes = lazy(() =>
  carregarPartidaTimes().then((m) => ({ default: m.PartidaTimes }))
);
export const PartidaAoVivo = lazy(() =>
  carregarPartidaAoVivo().then((m) => ({ default: m.PartidaAoVivo }))
);
export const PartidaEditar = lazy(() =>
  carregarPartidaEditar().then((m) => ({ default: m.PartidaEditar }))
);
export const PartidaVotar = lazy(() =>
  carregarPartidaVotar().then((m) => ({ default: m.PartidaVotar }))
);
export const NovoJogador = lazy(() =>
  carregarNovoJogador().then((m) => ({ default: m.NovoJogador }))
);
export const GestaoJogadores = lazy(() =>
  carregarGestaoJogadores().then((m) => ({ default: m.GestaoJogadores }))
);
export const GestaoGoleiros = lazy(() =>
  carregarGestaoGoleiros().then((m) => ({ default: m.GestaoGoleiros }))
);
export const Administrador = lazy(() =>
  carregarAdministrador().then((m) => ({ default: m.Administrador }))
);
export const Notificacoes = lazy(() =>
  carregarNotificacoes().then((m) => ({ default: m.Notificacoes }))
);

/**
 * Tabela de prefetch: padrão ancorado no início do pathname (semântica de
 * prefixo) → carregador do chunk. A ordem importa: padrões mais específicos
 * vêm primeiro (ex.: `/partida/nova/times` antes de `/partida/nova`;
 * sufixos de `/partida/:id` antes do detalhe puro).
 */
const TABELA_PRE_CARREGAMENTO: Array<{
  padrao: RegExp;
  carregar: () => Promise<unknown>;
}> = [
  { padrao: /^\/partida\/nova\/confirma/, carregar: carregarPartidaConfirma },
  { padrao: /^\/partida\/nova\/times/, carregar: carregarPartidaNovaTimes },
  { padrao: /^\/partida\/nova/, carregar: carregarPartidaNova },
  { padrao: /^\/partida\/\d+\/times/, carregar: carregarPartidaTimes },
  { padrao: /^\/partida\/\d+\/ao-vivo/, carregar: carregarPartidaAoVivo },
  { padrao: /^\/partida\/\d+\/editar/, carregar: carregarPartidaEditar },
  { padrao: /^\/partida\/\d+\/votar/, carregar: carregarPartidaVotar },
  { padrao: /^\/partida\/\d+/, carregar: carregarPartidaDetalhe },
  { padrao: /^\/estatisticas\/comparar/, carregar: carregarComparador },
  { padrao: /^\/estatisticas\/racha/, carregar: carregarEstatisticasRacha },
  { padrao: /^\/estatisticas/, carregar: carregarEstatisticas },
  { padrao: /^\/ranking/, carregar: carregarRanking },
  { padrao: /^\/jogos/, carregar: carregarJogos },
  { padrao: /^\/perfil/, carregar: carregarPerfil },
  { padrao: /^\/gestao-jogadores/, carregar: carregarGestaoJogadores },
  { padrao: /^\/gestao-goleiros/, carregar: carregarGestaoGoleiros },
  { padrao: /^\/jogador\/novo/, carregar: carregarNovoJogador },
  { padrao: /^\/administrador/, carregar: carregarAdministrador },
  { padrao: /^\/notificacoes/, carregar: carregarNotificacoes },
  { padrao: /^\/login/, carregar: carregarLogin },
  { padrao: /^\/$/, carregar: carregarResumo },
];

/**
 * Dispara o download antecipado do chunk da rota destino (best-effort).
 *
 * Não há `await`: o `import()` dinâmico devolve sempre a mesma promise
 * cacheada para um mesmo specifier, então a navegação via `React.lazy`
 * reutiliza o módulo já baixado, sem novo round-trip. Para paths não
 * mapeados, não faz nada.
 */
export function preCarregarRota(path: string): void {
  const entrada = TABELA_PRE_CARREGAMENTO.find((rota) => rota.padrao.test(path));
  if (!entrada) return;
  // Falhas de prefetch são silenciadas: são best-effort e a navegação real
  // reporta erros pelo Suspense/ErrorBoundary no momento adequado.
  entrada.carregar().catch(() => undefined);
}
