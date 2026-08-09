import { useJogadorLogado } from './useJogadorLogado'

export function useAdmin() {
  const jogador = useJogadorLogado()
  return jogador?.is_admin ?? false
}
