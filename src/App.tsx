import { Routes, Route, Navigate } from 'react-router-dom'
import { SessaoProvider } from './context/SessaoContext'
import { Layout } from './routes/Layout'
import { Login } from './routes/Login'
import { Jogos } from './routes/Jogos'
import { Ranking } from './routes/Ranking'
import { Perfil } from './routes/Perfil'
import { PartidaNova } from './routes/PartidaNova'
import { PartidaDetalhe } from './routes/PartidaDetalhe'

export function App() {
  return (
    <SessaoProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Jogos />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/partida/nova" element={<PartidaNova />} />
          <Route path="/partida/:id" element={<PartidaDetalhe />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessaoProvider>
  )
}
