import { useSessao } from '../context/SessaoContext'

export function useJogadorLogado() {
  const { jogador } = useSessao()
  return jogador
}
