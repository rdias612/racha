import { supabase } from './supabase';

// Controle financeiro: lançamentos por natureza (receita | despesa).
// Receita = racha a receber (dívida do jogador). Despesa = racha a pagar.
// Cada linha da tabela `dividas` = UM lançamento individual.

export type NaturezaLancamento = 'receita' | 'despesa';

export type TipoDivida = 'mensalidade' | 'avulso' | 'outro' | 'goleiro' | 'campo' | 'eventos';

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
  jogadores?: {
    username: string;
    is_mensalista: boolean;
    chave_pix?: string | null;
    telefone?: string | null;
  } | null;
}

// Agrupamento usado pela tela Administrador: total + itens por jogador (receitas).
export interface DividaPorJogador {
  jogador_id: number;
  username: string;
  is_mensalista: boolean;
  total_devido: number;
  dividas: Divida[];
}

export const SELECT_DIVIDA =
  'id, jogador_id, tipo, natureza, valor, descricao, referencia, partida_id, data_divida, paga, data_pagamento, created_at, jogadores(username, is_mensalista, chave_pix, telefone)';

/**
 * Mapeia uma linha bruta da tabela `dividas` (com join em `jogadores`) para a interface `Divida`,
 * normalizando a natureza do lançamento com fallback defensivo para 'receita'.
 */
export function mapearLinhaDivida(row: unknown): Divida {
  const r = row as unknown as Divida;
  return {
    ...r,
    natureza: (r.natureza ?? 'receita') as NaturezaLancamento,
  };
}

/** Lista todas as dívidas/lançamentos em aberto (paga = false), já com username do jogador. */
export async function listarDividasEmAberto(): Promise<Divida[]> {
  const { data, error } = await supabase
    .from('dividas')
    .select(SELECT_DIVIDA)
    .eq('paga', false)
    .order('data_divida', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapearLinhaDivida);
}

/** Linha da view `dividas_resumo` (total devido + qtd por jogador — só receitas). */
export interface DevedorResumo {
  jogador_id: number;
  username: string;
  is_mensalista: boolean;
  total_devido: number;
  qtd_dividas: number;
}

/** Lista devedores (total_devido > 0) via view `dividas_resumo`, pelo maior total. */
export async function listarResumoDevedores(): Promise<DevedorResumo[]> {
  const { data, error } = await supabase
    .from('dividas_resumo')
    .select('jogador_id, username, is_mensalista, total_devido, qtd_dividas')
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
    p_descricao: input.descricao ? input.descricao.trim() : null,
    p_referencia: input.referencia ? input.referencia.trim() : null,
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
 * Detecta se uma mensagem de erro indica que a migration de natureza está ausente.
 * Encapsula o conhecimento de infra para não vazar regex de banco para a UI.
 */
export function isMigrationAusenteNatureza(msg: string): boolean {
  return /natureza|column|schema|PGRST/i.test(msg);
}

/**
 * Monta o texto do lembrete de cobrança para WhatsApp a partir de um grupo de dívidas.
 * A formatação textual é conhecimento do domínio financeiro, não da UI.
 */
export function montarLembreteWhatsApp(
  g: DividaPorJogador,
  formatarReais: (v: number) => string,
  formatarDataLista: (d: string) => string
): string {
  const linhas = g.dividas
    .map(
      (d) =>
        `• ${labelTipoDivida(d.tipo)} (${formatarDataLista(d.data_divida)}): ${formatarReais(Number(d.valor))}${d.descricao ? ` — ${d.descricao}` : ''}`
    )
    .join('\n');

  return `⚽ *Súmula Financeira — Racha Gragoatá*\n\nFala @${g.username}! Segue o resumo das pendências em aberto:\n\n${linhas}\n\n*Total em aberto: ${formatarReais(g.total_devido)}*\n\nValeu pela força e nos vemos quinta! 👊`;
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
    .select(SELECT_DIVIDA)
    .gte('data_divida', dataInicio)
    .lte('data_divida', dataFim)
    .order('data_divida', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapearLinhaDivida);
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
      l.jogadores?.username != null
        ? `@${l.jogadores.username}`
        : l.jogador_id != null
          ? `#${l.jogador_id}`
          : 'Caixa do racha';
    const valor = l.natureza === 'despesa' ? -Number(l.valor) : Number(l.valor);
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
