import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SessaoProvider } from './context/SessaoContext';
import { Layout } from './routes/Layout';
import { CarregandoGeral } from './components/Skeletons';
import {
  Login,
  Resumo,
  Jogos,
  Ranking,
  Perfil,
  Estatisticas,
  EstatisticasRacha,
  Comparador,
  PartidaNova,
  PartidaConfirma,
  PartidaNovaTimes,
  PartidaDetalhe,
  PartidaTimes,
  PartidaAoVivo,
  PartidaEditar,
  PartidaVotar,
  NovoJogador,
  GestaoJogadores,
  Administrador,
} from './lib/rotas';

export function App() {
  return (
    <SessaoProvider>
      <Routes>
        {/* Login vive fora do Layout: boundary próprio para não piscar o shell.
            As rotas do Layout têm seu Suspense (com skeleton por rota) no Outlet. */}
        <Route
          path="/login"
          element={
            <Suspense fallback={<CarregandoGeral />}>
              <Login />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route path="/" element={<Resumo />} />
          <Route path="/jogos" element={<Jogos />} />
          <Route path="/ranking" element={<Navigate to="/ranking/pontos" replace />} />
          <Route path="/ranking/:metrica" element={<Ranking />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/estatisticas" element={<Navigate to="/estatisticas/jogador" replace />} />
          <Route path="/estatisticas/jogador" element={<Estatisticas />} />
          <Route path="/estatisticas/racha" element={<EstatisticasRacha />} />
          <Route path="/estatisticas/comparar" element={<Comparador />} />
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
    </SessaoProvider>
  );
}
