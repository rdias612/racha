import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { baixarExcelLancamentos } from '../lib/exportacao';
import { listarLancamentosPorPeriodo } from '../lib/dividas';
import { hojeStr, primeiroDiaMesStr } from '../lib/formatacao';
import { formatarMensagemErro } from '../lib/erros';

export interface SecaoExportacaoFinanceiraProps {
  onNotificar: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

export function SecaoExportacaoFinanceira({ onNotificar }: SecaoExportacaoFinanceiraProps) {
  const [exportDe, setExportDe] = useState(primeiroDiaMesStr());
  const [exportAte, setExportAte] = useState(hojeStr());
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    if (!exportDe || !exportAte) {
      onNotificar('erro', 'Informe o período de exportação.');
      return;
    }
    if (exportDe > exportAte) {
      onNotificar('erro', 'A data inicial não pode ser maior que a final.');
      return;
    }

    setExportando(true);
    try {
      const lancamentos = await listarLancamentosPorPeriodo(exportDe, exportAte);
      if (lancamentos.length === 0) {
        onNotificar('erro', 'Nenhum lançamento nesse período.');
        return;
      }
      baixarExcelLancamentos(lancamentos, exportDe, exportAte);
      onNotificar(
        'sucesso',
        `Excel gerado com ${lancamentos.length} lançamento${lancamentos.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      onNotificar('erro', formatarMensagemErro(err, 'Erro ao exportar o período.'));
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="size-4 text-destaque-texto" />
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Exportar período
        </h3>
      </div>
      <p className="text-xs text-giz-fraco font-sans">
        Baixa o histórico completo (receitas e despesas, quitados e em aberto) da tabela financeira
        no intervalo escolhido.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            De
          </span>
          <input
            type="date"
            value={exportDe}
            onChange={(e) => setExportDe(e.target.value)}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Até
          </span>
          <input
            type="date"
            value={exportAte}
            onChange={(e) => setExportAte(e.target.value)}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleExportar}
        disabled={exportando}
        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo transition active:translate-y-px hover:border-destaque disabled:opacity-50"
      >
        <FileSpreadsheet className="size-4 text-destaque-texto" />
        {exportando ? 'Gerando…' : 'Exportar Excel'}
      </button>
    </section>
  );
}
