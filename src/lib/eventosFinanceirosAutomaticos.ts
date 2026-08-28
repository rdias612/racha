import { supabase } from './supabase';
import type { NaturezaLancamento, TipoDivida } from './dividas';

export type GatilhoEventoAuto = 'mensal' | 'fim_partida';

export type DestinoEventoAuto = 'caixa' | 'mensalistas' | 'goleiros_partida' | 'jogador_fixo';

export interface EventoFinanceiroAutomatico {
  id: number;
  nome: string;
  gatilho: GatilhoEventoAuto;
  natureza: NaturezaLancamento;
  tipo: TipoDivida;
  valor: number;
  destino: DestinoEventoAuto;
  jogador_id: number | null;
  descricao_template: string;
  referencia_template: string | null;
  ativo: boolean;
  created_at: string;
}

export const GATILHOS_EVENTO_AUTO: { value: GatilhoEventoAuto; label: string }[] = [
  { value: 'mensal', label: 'Virada do mês (dia 01)' },
  { value: 'fim_partida', label: 'Fim da partida' },
];

export const DESTINOS_EVENTO_AUTO: {
  value: DestinoEventoAuto;
  label: string;
  gatilhos: GatilhoEventoAuto[];
}[] = [
  { value: 'caixa', label: 'Caixa do racha', gatilhos: ['mensal', 'fim_partida'] },
  { value: 'mensalistas', label: 'Cada mensalista', gatilhos: ['mensal'] },
  {
    value: 'goleiros_partida',
    label: 'Goleiros da partida',
    gatilhos: ['fim_partida'],
  },
  { value: 'jogador_fixo', label: 'Jogador fixo', gatilhos: ['mensal', 'fim_partida'] },
];

export async function listarEventosAutomaticos(): Promise<EventoFinanceiroAutomatico[]> {
  const { data, error } = await supabase
    .from('eventos_financeiros_automaticos')
    .select(
      'id, nome, gatilho, natureza, tipo, valor, destino, jogador_id, descricao_template, referencia_template, ativo, created_at'
    )
    .order('gatilho')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as EventoFinanceiroAutomatico[];
}

export interface EventoFinanceiroAutomaticoPayload {
  id?: number;
  nome: string;
  gatilho: GatilhoEventoAuto;
  natureza: NaturezaLancamento;
  tipo: TipoDivida;
  valor: number;
  destino: DestinoEventoAuto;
  jogador_id?: number | null;
  descricao_template: string;
  referencia_template?: string | null;
  ativo?: boolean;
}

export async function salvarEventoAutomatico(
  input: EventoFinanceiroAutomaticoPayload
): Promise<number> {
  const payload = {
    nome: input.nome.trim(),
    gatilho: input.gatilho,
    natureza: input.natureza,
    tipo: input.tipo,
    valor: input.valor,
    destino: input.destino,
    jogador_id: input.destino === 'jogador_fixo' ? (input.jogador_id ?? null) : null,
    descricao_template: input.descricao_template.trim(),
    referencia_template: input.referencia_template?.trim() || null,
    ativo: input.ativo ?? true,
  };

  if (input.id != null) {
    const { error } = await supabase
      .from('eventos_financeiros_automaticos')
      .update(payload)
      .eq('id', input.id);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await supabase
    .from('eventos_financeiros_automaticos')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function excluirEventoAutomatico(id: number): Promise<void> {
  const { error } = await supabase.from('eventos_financeiros_automaticos').delete().eq('id', id);
  if (error) throw error;
}

export function labelGatilho(gatilho: GatilhoEventoAuto | string): string {
  return GATILHOS_EVENTO_AUTO.find((g) => g.value === gatilho)?.label ?? gatilho;
}

export function labelDestino(destino: DestinoEventoAuto | string): string {
  return DESTINOS_EVENTO_AUTO.find((d) => d.value === destino)?.label ?? destino;
}
