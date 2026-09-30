import { useMemo, useState, type FormEvent } from 'react';
import { CampoTexto } from './ui/CampoTexto';
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
      ...jogadores.map((j) => ({ value: String(j.id), label: j.username })),
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

      <CampoTexto
        rotulo="Nome"
        valor={form.nome}
        aoMudar={(novoValor) => setForm((f) => ({ ...f, nome: novoValor }))}
        placeholder="ex.: Aluguel do campo"
        obrigatorio
      />

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

        <CampoTexto
          rotulo="Valor (R$)"
          tipo="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          valor={form.valor}
          aoMudar={(novoValor) => setForm((f) => ({ ...f, valor: novoValor }))}
          fonteMono
          obrigatorio
        />

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

        <CampoTexto
          rotulo="Descrição (modelo)"
          valor={form.descricao_template}
          aoMudar={(novoValor) => setForm((f) => ({ ...f, descricao_template: novoValor }))}
          placeholder="ex.: Diária goleiro racha dia {data}"
          obrigatorio
          className="col-span-2"
        />

        <CampoTexto
          rotulo={`Referência ${form.tipo === 'mensalidade' ? '(mês)' : '(opcional)'}`}
          valor={form.referencia_template}
          aoMudar={(novoValor) => setForm((f) => ({ ...f, referencia_template: novoValor }))}
          placeholder="ex.: 2026-08"
          fonteMono
          className="col-span-2"
        />

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
