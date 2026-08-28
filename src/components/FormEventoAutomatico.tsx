import { useMemo, useState, type FormEvent } from 'react';
import { SelectSumula } from './SelectSumula';
import {
  NATUREZAS_LANCAMENTO,
  TIPOS_DIVIDA,
  type NaturezaLancamento,
  type TipoDivida,
} from '../lib/dividas';
import {
  DESTINOS_EVENTO_AUTO,
  GATILHOS_EVENTO_AUTO,
  type DestinoEventoAuto,
  type EventoFinanceiroAutomatico,
  type EventoFinanceiroAutomaticoPayload,
  type GatilhoEventoAuto,
} from '../lib/eventosFinanceirosAutomaticos';
import type { JogadorLista } from '../lib/jogadores';

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2';

export interface FormEventoAutomaticoProps {
  eventoEmEdicao: EventoFinanceiroAutomatico | null;
  jogadores: JogadorLista[];
  salvando: boolean;
  onSalvar: (dados: EventoFinanceiroAutomaticoPayload) => Promise<void>;
  onCancelar: () => void;
  onMensagem: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

type FormState = {
  id?: number;
  nome: string;
  gatilho: GatilhoEventoAuto;
  natureza: NaturezaLancamento;
  tipo: TipoDivida;
  valor: string;
  destino: DestinoEventoAuto;
  jogador_id: string;
  descricao_template: string;
  referencia_template: string;
  ativo: boolean;
};

function formVazio(): FormState {
  return {
    nome: '',
    gatilho: 'mensal',
    natureza: 'despesa',
    tipo: 'campo',
    valor: '',
    destino: 'caixa',
    jogador_id: '',
    descricao_template: '',
    referencia_template: '',
    ativo: true,
  };
}

function formDeEvento(e: EventoFinanceiroAutomatico): FormState {
  return {
    id: e.id,
    nome: e.nome,
    gatilho: e.gatilho,
    natureza: e.natureza,
    tipo: e.tipo,
    valor: String(e.valor),
    destino: e.destino,
    jogador_id: e.jogador_id != null ? String(e.jogador_id) : '',
    descricao_template: e.descricao_template,
    referencia_template: e.referencia_template ?? '',
    ativo: e.ativo,
  };
}

export function FormEventoAutomatico({
  eventoEmEdicao,
  jogadores,
  salvando,
  onSalvar,
  onCancelar,
  onMensagem,
}: FormEventoAutomaticoProps) {
  const [form, setForm] = useState<FormState>(() =>
    eventoEmEdicao ? formDeEvento(eventoEmEdicao) : formVazio()
  );

  const destinosDisponiveis = useMemo(
    () => DESTINOS_EVENTO_AUTO.filter((d) => d.gatilhos.includes(form.gatilho)),
    [form.gatilho]
  );

  const opcoesJogador = useMemo(
    () => [
      { value: '', label: 'Selecione…' },
      ...jogadores.map((j) => ({ value: String(j.id), label: `@${j.username}` })),
    ],
    [jogadores]
  );

  function aoTrocarGatilho(gatilho: GatilhoEventoAuto) {
    const destinos = DESTINOS_EVENTO_AUTO.filter((d) => d.gatilhos.includes(gatilho));
    const destinoAtualOk = destinos.some((d) => d.value === form.destino);
    setForm((f) => ({
      ...f,
      gatilho,
      destino: destinoAtualOk ? f.destino : (destinos[0]?.value ?? 'caixa'),
      jogador_id: destinoAtualOk && f.destino === 'jogador_fixo' ? f.jogador_id : '',
    }));
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    const valor = Number(form.valor.replace(',', '.'));
    if (!form.nome.trim()) {
      onMensagem('erro', 'Informe o nome do evento.');
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      onMensagem('erro', 'Valor deve ser maior que zero.');
      return;
    }
    if (!form.descricao_template.trim()) {
      onMensagem('erro', 'Informe o modelo da descrição.');
      return;
    }
    if (form.destino === 'jogador_fixo' && !form.jogador_id) {
      onMensagem('erro', 'Selecione o jogador fixo.');
      return;
    }

    await onSalvar({
      id: form.id,
      nome: form.nome,
      gatilho: form.gatilho,
      natureza: form.natureza,
      tipo: form.tipo,
      valor,
      destino: form.destino,
      jogador_id: form.jogador_id ? Number(form.jogador_id) : null,
      descricao_template: form.descricao_template,
      referencia_template: form.referencia_template || null,
      ativo: form.ativo,
    });
  }

  return (
    <form
      onSubmit={handleSalvar}
      className="space-y-3 rounded-[4px] border border-borda bg-fundo/40 p-3"
    >
      <h4 className="font-display font-bold text-xs uppercase tracking-wider text-giz">
        {form.id ? 'Editar evento' : 'Novo evento'}
      </h4>

      <label className="block">
        <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
          Nome
        </span>
        <input
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          placeholder="ex.: Aluguel do campo"
          className={INPUT_CLASS}
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Quando
          </span>
          <SelectSumula
            value={form.gatilho}
            onChange={(v) => aoTrocarGatilho(v as GatilhoEventoAuto)}
            aria-label="Quando"
            opcoes={GATILHOS_EVENTO_AUTO.map((g) => ({ value: g.value, label: g.label }))}
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Natureza
          </span>
          <SelectSumula
            value={form.natureza}
            onChange={(v) => setForm((f) => ({ ...f, natureza: v as NaturezaLancamento }))}
            aria-label="Natureza"
            opcoes={NATUREZAS_LANCAMENTO.map((n) => ({ value: n.value, label: n.label }))}
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Tipo
          </span>
          <SelectSumula
            value={form.tipo}
            onChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoDivida }))}
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
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            className={`${INPUT_CLASS} font-mono`}
            required
          />
        </label>

        <label className="block col-span-2">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Destino
          </span>
          <SelectSumula
            value={form.destino}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                destino: v as DestinoEventoAuto,
                jogador_id: v === 'jogador_fixo' ? f.jogador_id : '',
              }))
            }
            aria-label="Destino"
            opcoes={destinosDisponiveis.map((d) => ({ value: d.value, label: d.label }))}
          />
        </label>

        {form.destino === 'jogador_fixo' && (
          <label className="block col-span-2">
            <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
              Jogador
            </span>
            <SelectSumula
              value={form.jogador_id}
              onChange={(v) => setForm((f) => ({ ...f, jogador_id: v }))}
              aria-label="Jogador"
              opcoes={opcoesJogador}
            />
          </label>
        )}

        <label className="block col-span-2">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Descrição (modelo)
          </span>
          <input
            value={form.descricao_template}
            onChange={(e) => setForm((f) => ({ ...f, descricao_template: e.target.value }))}
            placeholder="ex.: Diária goleiro racha dia {data}"
            className={INPUT_CLASS}
            required
          />
        </label>

        <label className="block col-span-2">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Referência {form.tipo === 'mensalidade' ? '(mês)' : '(opcional)'}
          </span>
          <input
            value={form.referencia_template}
            onChange={(e) => setForm((f) => ({ ...f, referencia_template: e.target.value }))}
            placeholder="ex.: 2026-08"
            className={`${INPUT_CLASS} font-mono`}
          />
        </label>

        <label className="col-span-2 flex min-h-[44px] items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            className="accent-destaque size-4 rounded-[2px]"
          />
          <span className="text-sm font-display uppercase tracking-wider text-giz">Ativo</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-[44px] flex-1 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-giz"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="min-h-[44px] flex-1 rounded-[4px] border border-destaque bg-destaque px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-destaque-tinta disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : form.id ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}
