import { Routes, Route, Navigate } from "react-router-dom";
import { SessaoProvider } from "./context/SessaoContext";
import { Layout } from "./routes/Layout";
import { Login } from "./routes/Login";
import { Ranking } from "./routes/Ranking";
import { Perfil } from "./routes/Perfil";
import { Estatisticas } from "./routes/Estatisticas";
import { EstatisticasRacha } from "./routes/EstatisticasRacha";
import { Resumo } from "./routes/Resumo";
import { Jogos } from "./routes/Jogos";
import { PartidaNova } from "./routes/PartidaNova";
import { PartidaConfirma } from "./routes/PartidaConfirma";
import { PartidaNovaTimes } from "./routes/PartidaNovaTimes";
import { PartidaDetalhe } from "./routes/PartidaDetalhe";
import { PartidaEditar } from "./routes/PartidaEditar";
import { PartidaTimes } from "./routes/PartidaTimes";
import { PartidaAoVivo } from "./routes/PartidaAoVivo";
import { PartidaVotar } from "./routes/PartidaVotar";
import { NovoJogador } from "./routes/NovoJogador";
import { Administrador } from "./routes/Administrador";
import { GestaoJogadores } from "./routes/GestaoJogadores";

export function App() {
  return (
    <SessaoProvider>
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
    </SessaoProvider>
  );
}
