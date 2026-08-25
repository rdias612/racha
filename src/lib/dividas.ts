import { supabase } from './supabase';

// Controle financeiro: lançamentos por natureza (receita | despesa).
// Receita = racha a receber (dívida do jogador). Despesa = racha a pagar.
// Cada linha da tabela `dividas` = UM lançamento individual.

export type NaturezaLancamento = 'receita' | 'despesa';

export type TipoDivida =
  | 'mensalidade'
  | 'avulso'
  | 'outro'
  | 'goleiro'
  | 'campo'
  | 'eventos';

export const NATUREZAS_LANCAMENTO: { value: NaturezaLancamento; label: string }[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
];

export const TIPOS_DIVIDA: { value: TipoDivida; label: string }[] = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'avulso', label: 'Avulso' },
  { value: 'goleiro', label: 'Goleiro' },
  { value: 'campo', label: 'Campo' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'outro', label: 'Outro' },
];

export interface Divida {
  id: number;
  jogador_id: number | null;
  tipo: TipoDivida;
  natureza: NaturezaLancamento;
  valor: number;
  descricao: string | null;
  referencia: string | null;
  partida_id: number | null;
  data_divida: string;
  paga: boolean;
  data_pagamento: string | null;
  created_at: string;
  jogadores?: { nome: string; username: string; is_mensalista: boolean } | null;
}

// Agrupamento usado pela tela Administrador: total + itens por jogador (receitas).
export interface DividaPorJogador {
  jogador_id: number;
  nome: string;
  username: string;
  is_mensalista: boolean;
  total_devido: number;
  dividas: Divida[];
}

/** Lista todas as dívidas/lançamentos em aberto (paga = false), já com nome do jogador. */
export async function listarDividasEmAberto(): Promise<Divida[]> {
  const { data, error } = await supabase
    .from('dividas')
    .select(
      'id, jogador_id, tipo, natureza, valor, descricao, referencia, partida_id, data_divida, paga, data_pagamento, created_at, jogadores(nome, username, is_mensalista)'
    )
    .eq('paga', false)
    .order('data_divida', { ascending: false });
  if (error) throw error;
  // Cast via unknown: o cliente Supabase infere `jogadores` como array, mas em
  // runtime o join m:1 devolve um objeto (ou null). Vide migration 051 (FK única).
  return (data ?? []).map((row) => {
    const r = row as unknown as Divida;
    return {
      ...r,
      natureza: r.natureza ?? 'receita',
    };
  });
}

/** Linha da view `dividas_resumo` (total devido + qtd por jogador — só receitas). */
export interface DevedorResumo {
  jogador_id: number;
  nome: string;
  username: string;
  is_mensalista: boolean;
  total_devido: number;
  qtd_dividas: number;
}

/** Lista devedores (total_devido > 0) via view `dividas_resumo`, pelo maior total. */
export async function listarResumoDevedores(): Promise<DevedorResumo[]> {
  const { data, error } = await supabase
    .from('dividas_resumo')
    .select('jogador_id, nome, username, is_mensalista, total_devido, qtd_dividas')
    .gt('total_devido', 0)
    .order('total_devido', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DevedorResumo[];
}

/** Lança um novo item financeiro (server-side via RPC). Retorna o id criado. */
export async function registrarDivida(input: {
  jogador_id?: number | null;
  tipo: TipoDivida;
  natureza?: NaturezaLancamento;
  valor: number;
  data_divida?: string;
  descricao?: string;
  referencia?: string;
  partida_id?: number;
}): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_divida', {
    p_jogador_id: input.jogador_id ?? null,
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_data_divida: input.data_divida ?? null,
    p_descricao: input.descricao ?? null,
    p_referencia: input.referencia ?? null,
    p_partida_id: input.partida_id ?? null,
    p_natureza: input.natureza ?? 'receita',
  });
  if (error) throw error;
  return data;
}

/** Marca uma única dívida/lançamento como pago. */
export async function quitarDivida(dividaId: number): Promise<void> {
  const { error } = await supabase.rpc('quitar_divida', { p_divida_id: dividaId });
  if (error) throw error;
}

/** Marca TODAS as dívidas em aberto de um jogador como pagas. */
export async function quitarDividasJogador(jogadorId: number): Promise<void> {
  const { error } = await supabase.rpc('quitar_dividas_jogador', {
    p_jogador_id: jogadorId,
  });
  if (error) throw error;
}

export function labelTipoDivida(tipo: TipoDivida | string): string {
  return TIPOS_DIVIDA.find((t) => t.value === tipo)?.label ?? tipo;
}

/**
 * Histórico completo (pagos e em aberto) por `data_divida` inclusiva.
 * A tabela `dividas` preserva todos os lançamentos; quitação só marca `paga = true`.
 */
export async function listarLancamentosPorPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<Divida[]> {
  const { data, error } = await supabase
    .from('dividas')
    .select(
      'id, jogador_id, tipo, natureza, valor, descricao, referencia, partida_id, data_divida, paga, data_pagamento, created_at, jogadores(nome, username, is_mensalista)'
    )
    .gte('data_divida', dataInicio)
    .lte('data_divida', dataFim)
    .order('data_divida', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as Divida;
    return {
      ...r,
      natureza: r.natureza ?? 'receita',
    };
  });
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Gera planilha Excel (SpreadsheetML .xls) e dispara o download no browser. */
export function baixarExcelLancamentos(
  lancamentos: Divida[],
  dataInicio: string,
  dataFim: string
): void {
  const cabecalhos = [
    'Data',
    'Natureza',
    'Tipo',
    'Jogador',
    'Valor',
    'Status',
    'Data pagamento',
    'Referência',
    'Descrição',
    'Partida',
  ];

  const linhas = lancamentos.map((l) => {
    const natureza = l.natureza === 'despesa' ? 'Despesa' : 'Receita';
    const jogador =
      l.jogadores?.nome ?? (l.jogador_id != null ? `#${l.jogador_id}` : 'Caixa do racha');
    const valor =
      l.natureza === 'despesa' ? -Number(l.valor) : Number(l.valor);
    return [
      l.data_divida,
      natureza,
      labelTipoDivida(l.tipo),
      jogador,
      valor.toFixed(2).replace('.', ','),
      l.paga ? 'Quitado' : 'Em aberto',
      l.data_pagamento ?? '',
      l.referencia ?? '',
      l.descricao ?? '',
      l.partida_id != null ? String(l.partida_id) : '',
    ];
  });

  const celulasCabecalho = cabecalhos
    .map((h) => `<Cell><Data ss:Type="String">${escaparXml(h)}</Data></Cell>`)
    .join('');

  const linhasXml = linhas
    .map((cols) => {
      const cells = cols
        .map((c, i) => {
          // Coluna Valor (índice 4): número
          if (i === 4) {
            const num = Number(String(c).replace(',', '.'));
            return `<Cell><Data ss:Type="Number">${Number.isFinite(num) ? num : 0}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escaparXml(c)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Financeiro">
  <Table>
   <Row>${celulasCabecalho}</Row>
   ${linhasXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `racha-financeiro_${dataInicio}_${dataFim}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
