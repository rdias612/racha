import { supabase } from './supabase'

export interface JogadorLista {
  id: number
  username: string
  nome: string
  posicao: 'gk' | 'def' | 'mid' | 'fwd'
  is_admin: boolean
  is_ativo: boolean
}

export async function listarJogadoresAtivos(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select('id, username, nome, posicao, is_admin, is_ativo')
    .eq('is_ativo', true)
    .order('nome')

  if (error) throw error
  return data ?? []
}
