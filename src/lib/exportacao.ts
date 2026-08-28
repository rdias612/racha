import { labelTipoDivida, type Divida } from './dividas';

export function escaparXml(valor: string): string {
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
