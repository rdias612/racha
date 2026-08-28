import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { SelectSumula } from './SelectSumula';
import { hojeStr, mesAtualStr } from '../lib/formatacao';
import {
  NATUREZAS_LANCAMENTO,
  TIPOS_DIVIDA,
  registrarDivida,
  type NaturezaLancamento,
  type TipoDivida,
} from '../lib/dividas';
import type { JogadorLista } from '../lib/jogadores';
import { formatarMensagemErro } from '../lib/erros';

export interface FormLancamentoFinanceiroProps {
  jogadores: JogadorLista[];
  onSucesso: (mensagem: string) => void;
  onErro: (mensagem: string) => void;
  onRecarregar: () => Promise<void>;
}

export function FormLancamentoFinanceiro({
  jogadores,
  onSucesso,
  onErro,
  onRecarregar,
}: FormLancamentoFinanceiroProps) {
  const [fNatureza, setFNatureza] = useState<NaturezaLancamento>('receita');
  const [fJogador, setFJogador] = useState('');
  const [fTipo, setFTipo] = useState<TipoDivida>('mensalidade');
  const [fValor, setFValor] = useState('90');
  const [fData, setFData] = useState(hojeStr());
  const [fReferencia, setFReferencia] = useState(mesAtualStr());
  const [fDescricao, setFDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  function aoTrocarNatureza(natureza: NaturezaLancamento) {
    setFNatureza(natureza);
    if (natureza === 'receita') {
      setFTipo('mensalidade');
      setFValor('90');
      setFReferencia(mesAtualStr());
    } else {
      setFTipo('campo');
      setFValor('');
      setFReferencia('');
    }
  }

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();

    const valor = Number(fValor.replace(',', '.'));
    if (fNatureza === 'receita' && !fJogador) {
      onErro('Selecione o jogador da receita.');
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      onErro('Valor deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await registrarDivida({
        jogador_id: fJogador ? Number(fJogador) : null,
        tipo: fTipo,
        natureza: fNatureza,
        valor,
        data_divida: fData,
        referencia: fReferencia ? fReferencia.trim() : undefined,
        descricao: fDescricao ? fDescricao.trim() : undefined,
      });
      onSucesso(fNatureza === 'despesa' ? 'Despesa registrada.' : 'Receita registrada.');
      setFDescricao('');
      await onRecarregar();
    } catch (err) {
      onErro(formatarMensagemErro(err, 'Erro ao registrar lançamento.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={handleAdicionar}
      className="space-y-3 rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo"
    >
      <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
        Novo lançamento
      </h3>

      <fieldset>
        <legend className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1.5">
          Natureza
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {NATUREZAS_LANCAMENTO.map((n) => {
            const ativo = fNatureza === n.value;
            return (
              <button
                key={n.value}
                type="button"
                onClick={() => aoTrocarNatureza(n.value)}
                className={`min-h-[44px] rounded-[4px] border px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition active:translate-y-px ${
                  ativo
                    ? n.value === 'receita'
                      ? 'border-ok bg-ok/15 text-ok'
                      : 'border-perigo bg-perigo/15 text-perigo'
                    : 'border-borda bg-superficie-2 text-giz-fraco'
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="block col-span-2">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Jogador
            {fNatureza === 'despesa' ? ' (opcional)' : ''}
          </span>
          <SelectSumula
            value={fJogador}
            onChange={setFJogador}
            placeholder={fNatureza === 'despesa' ? 'Caixa do racha…' : 'Selecione…'}
            aria-label="Jogador"
            opcoes={[
              {
                value: '',
                label: fNatureza === 'despesa' ? 'Caixa do racha…' : 'Selecione…',
              },
              ...jogadores.map((j) => ({
                value: String(j.id),
                label: `@${j.username}${
                  j.posicao === 'goleiro'
                    ? ' (goleiro — isento)'
                    : j.is_mensalista
                      ? ' (mensalista)'
                      : ''
                }`,
              })),
            ]}
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Tipo
          </span>
          <SelectSumula
            value={fTipo}
            onChange={(v) => setFTipo(v as TipoDivida)}
            aria-label="Tipo"
            opcoes={TIPOS_DIVIDA.map((t) => ({ value: t.value, label: t.label }))}
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Valor (R$)
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={fValor}
            onChange={(e) => setFValor(e.target.value)}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Data
          </span>
          <input
            type="date"
            value={fData}
            onChange={(e) => setFData(e.target.value)}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Referência {fTipo === 'mensalidade' ? '(mês)' : '(opcional)'}
          </span>
          <input
            type="text"
            value={fReferencia}
            onChange={(e) => setFReferencia(e.target.value)}
            placeholder="ex.: 2026-08"
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>

        <label className="block col-span-2">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Descrição (opcional)
          </span>
          <input
            type="text"
            value={fDescricao}
            onChange={(e) => setFDescricao(e.target.value)}
            placeholder={
              fNatureza === 'despesa'
                ? 'ex.: Aluguel do campo — agosto'
                : 'ex.: Mensalidade Agosto/2026'
            }
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={salvando}
        className={`w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs shadow-carimbo transition active:translate-y-px disabled:opacity-50 ${
          fNatureza === 'despesa'
            ? 'border-perigo bg-perigo text-branco-time'
            : 'border-destaque bg-destaque text-destaque-tinta'
        }`}
      >
        <Plus className="size-4" />
        {salvando
          ? 'Salvando…'
          : fNatureza === 'despesa'
            ? 'Adicionar despesa'
            : 'Adicionar receita'}
      </button>
    </form>
  );
}
