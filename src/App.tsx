import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessaoProvider } from "./context/SessaoContext";

const Layout = lazy(() =>
  import("./routes/Layout").then((m) => ({ default: m.Layout }))
);
const Login = lazy(() =>
  import("./routes/Login").then((m) => ({ default: m.Login }))
);
const Ranking = lazy(() =>
  import("./routes/Ranking").then((m) => ({ default: m.Ranking }))
);
const Perfil = lazy(() =>
  import("./routes/Perfil").then((m) => ({ default: m.Perfil }))
);
const Estatisticas = lazy(() =>
  import("./routes/Estatisticas").then((m) => ({ default: m.Estatisticas }))
);
const EstatisticasRacha = lazy(() =>
  import("./routes/EstatisticasRacha").then((m) => ({
    default: m.EstatisticasRacha,
  }))
);
const Resumo = lazy(() =>
  import("./routes/Resumo").then((m) => ({ default: m.Resumo }))
);
const Jogos = lazy(() =>
  import("./routes/Jogos").then((m) => ({ default: m.Jogos }))
);
const PartidaNova = lazy(() =>
  import("./routes/PartidaNova").then((m) => ({ default: m.PartidaNova }))
);
const PartidaConfirma = lazy(() =>
  import("./routes/PartidaConfirma").then((m) => ({
    default: m.PartidaConfirma,
  }))
);
const PartidaNovaTimes = lazy(() =>
  import("./routes/PartidaNovaTimes").then((m) => ({
    default: m.PartidaNovaTimes,
  }))
);
const PartidaDetalhe = lazy(() =>
  import("./routes/PartidaDetalhe").then((m) => ({ default: m.PartidaDetalhe }))
);
const PartidaEditar = lazy(() =>
  import("./routes/PartidaEditar").then((m) => ({ default: m.PartidaEditar }))
);
const PartidaTimes = lazy(() =>
  import("./routes/PartidaTimes").then((m) => ({ default: m.PartidaTimes }))
);
const PartidaAoVivo = lazy(() =>
  import("./routes/PartidaAoVivo").then((m) => ({ default: m.PartidaAoVivo }))
);
const PartidaVotar = lazy(() =>
  import("./routes/PartidaVotar").then((m) => ({ default: m.PartidaVotar }))
);
const NovoJogador = lazy(() =>
  import("./routes/NovoJogador").then((m) => ({ default: m.NovoJogador }))
);
const Administrador = lazy(() =>
  import("./routes/Administrador").then((m) => ({ default: m.Administrador }))
);
const GestaoJogadores = lazy(() =>
  import("./routes/GestaoJogadores").then((m) => ({
    default: m.GestaoJogadores,
  }))
);

export function RotaFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-3xl space-y-4 px-3 py-6 sm:px-4 animate-pulse"
    >
      <div className="h-7 w-44 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="h-20 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-20 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-20 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-20 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="h-10 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <span className="sr-only">Carregando conteúdo...</span>
    </div>
  );
}

export function App() {
  return (
    <SessaoProvider>
      <Suspense fallback={<RotaFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Resumo />} />
            <Route path="/jogos" element={<Jogos />} />
            <Route
              path="/ranking"
              element={<Navigate to="/ranking/pontos" replace />}
            />
            <Route path="/ranking/:metrica" element={<Ranking />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route
              path="/estatisticas"
              element={<Navigate to="/estatisticas/jogador" replace />}
            />
            <Route path="/estatisticas/jogador" element={<Estatisticas />} />
            <Route path="/estatisticas/racha" element={<EstatisticasRacha />} />
            <Route path="/partida/nova" element={<PartidaNova />} />
            <Route path="/partida/nova/confirma" element={<PartidaConfirma />} />
            <Route path="/partida/nova/times" element={<PartidaNovaTimes />} />
            <Route path="/partida/:id" element={<PartidaDetalhe />} />
            <Route path="/partida/:id/times" element={<PartidaTimes />} />
            <Route path="/partida/:id/ao-vivo" element={<PartidaAoVivo />} />
            <Route path="/partida/:id/editar" element={<PartidaEditar />} />
            <Route path="/partida/:id/votar" element={<PartidaVotar />} />
            <Route path="/jogador/novo" element={<NovoJogador />} />
            <Route path="/gestao-jogadores" element={<GestaoJogadores />} />
            <Route path="/administrador" element={<Administrador />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SessaoProvider>
  );
}
