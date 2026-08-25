import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { Badge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { Carregando, MensagemEstado } from './Estado';
import { SelectSumula } from './SelectSumula';
import {
  NATUREZAS_LANCAMENTO,
  TIPOS_DIVIDA,
  labelTipoDivida,
  type NaturezaLancamento,
  type TipoDivida,
} from '../lib/dividas';
import {
  DESTINOS_EVENTO_AUTO,
  GATILHOS_EVENTO_AUTO,
  excluirEventoAutomatico,
  labelDestino,
  labelGatilho,
  listarEventosAutomaticos,
  salvarEventoAutomatico,
  type DestinoEventoAuto,
  type EventoFinanceiroAutomatico,
  type GatilhoEventoAuto,
} from '../lib/eventosFinanceirosAutomaticos';
import { formatarReais } from '../lib/formatacao';
import type { JogadorLista } from '../lib/jogadores';
import { formatarMensagemErro } from '../lib/erros';

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2';

interface EventosAutomaticosFinanceiroProps {
  jogadores: JogadorLista[];
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

export function EventosAutomaticosFinanceiro({
  jogadores,
  onMensagem,
}: EventosAutomaticosFinanceiroProps) {
  const [eventos, setEventos] = useState<EventoFinanceiroAutomatico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const carregar = useCallback(async (isAtivo?: () => boolean) => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarEventosAutomaticos();
      if (isAtivo && !isAtivo()) return;
      setEventos(lista);
    } catch (e) {
      if (isAtivo && !isAtivo()) return;
      const msg = formatarMensagemErro(e, 'Erro ao carregar eventos automáticos.');
      setErro(
        /eventos_financeiros_automaticos|schema|PGRST/i.test(msg)
          ? 'Aplique a migration 079_eventos_financeiros_automaticos.sql no Supabase.'
          : msg
      );
      setEventos([]);
    } finally {
      if (!isAtivo || isAtivo()) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

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

  function abrirNovo() {
    setForm(formVazio());
    setMostrandoForm(true);
  }

  function abrirEdicao(e: EventoFinanceiroAutomatico) {
    setForm(formDeEvento(e));
    setMostrandoForm(true);
  }

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

    setSalvando(true);
    try {
      await salvarEventoAutomatico({
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
      onMensagem(
        'sucesso',
        form.id ? 'Evento automático atualizado.' : 'Evento automático criado.'
      );
      setMostrandoForm(false);
      setForm(formVazio());
      await carregar();
    } catch (err) {
      onMensagem('erro', formatarMensagemErro(err, 'Erro ao salvar evento.'));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (excluindoId == null) return;
    const id = excluindoId;
    setExcluindoId(null);
    try {
      await excluirEventoAutomatico(id);
      onMensagem('sucesso', 'Evento automático removido.');
      if (form.id === id) {
        setMostrandoForm(false);
        setForm(formVazio());
      }
      await carregar();
    } catch (err) {
      onMensagem('erro', formatarMensagemErro(err, 'Erro ao excluir evento.'));
    }
  }

  return (
    <section className="space-y-3 rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="size-4 shrink-0 text-destaque" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz truncate">
            Eventos automáticos
          </h3>
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          className="min-h-[44px] shrink-0 inline-flex items-center gap-1 rounded-[4px] border border-destaque bg-destaque px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-destaque-tinta shadow-carimbo active:translate-y-px"
        >
          <Plus className="size-3.5" />
          Novo
        </button>
      </div>

      <p className="text-xs text-giz-fraco font-sans">
        Disparam sozinhos na virada do mês ou ao finalizar o racha. Placeholders da descrição:{' '}
        <span className="font-mono">{'{data} {mes} {ano} {mes_ano} {referencia} {username}'}</span>
      </p>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {mostrandoForm && (
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
                className="accent-[var(--cor-destaque)]"
              />
              <span className="text-sm font-display uppercase tracking-wider text-giz">Ativo</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMostrandoForm(false);
                setForm(formVazio());
              }}
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
      )}

      {carregando && eventos.length === 0 ? (
        <Carregando>Carregando eventos…</Carregando>
      ) : eventos.length === 0 ? (
        <MensagemEstado tipo="info">Nenhum evento automático cadastrado.</MensagemEstado>
      ) : (
        <ul className="divide-y divide-borda/40 border-y border-borda">
          {eventos.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2 py-2.5 min-h-[44px]">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display font-bold text-sm uppercase tracking-wide text-giz">
                    {ev.nome}
                  </span>
                  {!ev.ativo && <Badge variante="neutro">Inativo</Badge>}
                  <Badge variante={ev.natureza === 'despesa' ? 'perigo' : 'ok'}>
                    {ev.natureza === 'despesa' ? 'Despesa' : 'Receita'}
                  </Badge>
                </div>
                <p className="text-[11px] font-mono text-giz-fraco">
                  {labelGatilho(ev.gatilho)} · {labelTipoDivida(ev.tipo)} ·{' '}
                  {labelDestino(ev.destino)} · {formatarReais(Number(ev.valor))}
                </p>
                <p className="text-xs text-giz-fraco truncate">{ev.descricao_template}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => abrirEdicao(ev)}
                  title="Editar"
                  aria-label={`Editar ${ev.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-destaque hover:border-destaque/50"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setExcluindoId(ev.id)}
                  title="Remover"
                  aria-label={`Remover ${ev.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-perigo hover:border-perigo/50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={excluindoId != null}
        onClose={() => setExcluindoId(null)}
        onConfirm={confirmarExclusao}
        titulo="Remover evento automático?"
        mensagem="Lançamentos já gerados permanecem no histórico. Só a regra deixa de disparar."
        textoConfirmar="Remover"
        tomConfirmar="perigo"
      />
    </section>
  );
}
