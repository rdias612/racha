import { Routes, Route, Navigate } from "react-router-dom";
import { SessaoProvider } from "./context/SessaoContext";
import { Layout } from "./routes/Layout";
import { Login } from "./routes/Login";
import { Ranking } from "./routes/Ranking";
import { Perfil } from "./routes/Perfil";
import { PartidaNova } from "./routes/PartidaNova";
import { PartidaDetalhe } from "./routes/PartidaDetalhe";
import { PartidaEditar } from "./routes/PartidaEditar";
import { PartidaVotar } from "./routes/PartidaVotar";
import { NovoJogador } from "./routes/NovoJogador";

export function App() {
  return (
    <SessaoProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Perfil />} />
          <Route
            path="/ranking"
            element={<Navigate to="/ranking/pontos" replace />}
          />
          <Route path="/ranking/:metrica" element={<Ranking />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/partida/nova" element={<PartidaNova />} />
          <Route path="/partida/:id" element={<PartidaDetalhe />} />
          <Route path="/partida/:id/editar" element={<PartidaEditar />} />
          <Route path="/partida/:id/votar" element={<PartidaVotar />} />
          <Route path="/jogador/novo" element={<NovoJogador />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessaoProvider>
  );
}
