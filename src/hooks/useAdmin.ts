import { useJogadorLogado } from './useJogadorLogado';
import { isSuperAdmin } from '../lib/jogadores';

export function useAdmin() {
  const jogador = useJogadorLogado();
  if (!jogador) return false;
  return jogador.is_admin || isSuperAdmin(jogador.username);
}
