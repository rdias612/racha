import { supabase } from './supabase';
export { obterPartidaDraftAtual, type PartidaDraftAtual } from './partidas';

export interface NotificacoesConfig {
  id: number;
  confirmacao_ativo: boolean;
  confirmacao_dia_semana: number; // 1 = seg, 2 = ter, 3 = qua
  confirmacao_horario: string; // 'HH:MM:SS' ou 'HH:MM'
  confirmacao_titulo: string | null;
  confirmacao_mensagem: string | null;
  reforco_ativo: boolean;
  reforco_horas_antes_prazo: number;
  reforco_titulo: string | null;
  reforco_mensagem: string | null;
  votacao_ativo: boolean;
  votacao_bucket_6h: boolean;
  votacao_bucket_3h: boolean;
  votacao_bucket_1h: boolean;
  votacao_bucket_30m: boolean;
  votacao_template_6h_titulo: string | null;
  votacao_template_6h_msg: string | null;
  votacao_template_3h_titulo: string | null;
  votacao_template_3h_msg: string | null;
  votacao_template_1h_titulo: string | null;
  votacao_template_1h_msg: string | null;
  votacao_template_30m_titulo: string | null;
  votacao_template_30m_msg: string | null;
  updated_at?: string;
  updated_by?: number | null;
}

export async function obterConfiguracoesNotificacoes(adminId: number): Promise<NotificacoesConfig> {
  const { data, error } = await supabase.rpc('obter_configuracoes_notificacoes', {
    p_admin_id: adminId,
  });

  if (error) throw error;

  if (!data) {
    // Defaults locais caso a linha singleton não exista no momento
    return {
      id: 1,
      confirmacao_ativo: true,
      confirmacao_dia_semana: 1,
      confirmacao_horario: '10:00',
      confirmacao_titulo: null,
      confirmacao_mensagem: null,
      reforco_ativo: true,
      reforco_horas_antes_prazo: 4,
      reforco_titulo: null,
      reforco_mensagem: null,
      votacao_ativo: true,
      votacao_bucket_6h: true,
      votacao_bucket_3h: true,
      votacao_bucket_1h: true,
      votacao_bucket_30m: true,
      votacao_template_6h_titulo: null,
      votacao_template_6h_msg: null,
      votacao_template_3h_titulo: null,
      votacao_template_3h_msg: null,
      votacao_template_1h_titulo: null,
      votacao_template_1h_msg: null,
      votacao_template_30m_titulo: null,
      votacao_template_30m_msg: null,
    };
  }

  return data as unknown as NotificacoesConfig;
}

export async function salvarConfiguracoesNotificacoes(
  adminId: number,
  config: Partial<NotificacoesConfig>
): Promise<void> {
  const { error } = await supabase.rpc('salvar_configuracoes_notificacoes', {
    p_admin_id: adminId,
    p_config: config,
  });

  if (error) throw error;
}

export async function dispararPushTeste(adminId: number): Promise<void> {
  const { error } = await supabase.rpc('disparar_push_teste', {
    p_admin_id: adminId,
  });

  if (error) throw error;
}

export async function dispararConfirmacaoManual(adminId: number, partidaId: number): Promise<void> {
  const { error } = await supabase.rpc('disparar_confirmacao_manual', {
    p_admin_id: adminId,
    p_partida_id: partidaId,
  });

  if (error) throw error;
}

