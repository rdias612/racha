import { useJogadorLogado } from './useJogadorLogado';
import { isSuperAdminId } from '../lib/jogadores';

export function useAdmin() {
  const jogador = useJogadorLogado();
  if (!jogador) return false;
  return jogador.is_admin || isSuperAdminId(jogador.id);
}
