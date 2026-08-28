import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { Badge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { Carregando, MensagemEstado } from './Estado';
import { FormEventoAutomatico } from './FormEventoAutomatico';
import { labelTipoDivida } from '../lib/dividas';
import {
  excluirEventoAutomatico,
  labelDestino,
  labelGatilho,
  listarEventosAutomaticos,
  salvarEventoAutomatico,
  type EventoFinanceiroAutomatico,
  type EventoFinanceiroAutomaticoPayload,
} from '../lib/eventosFinanceirosAutomaticos';
import { formatarReais } from '../lib/formatacao';
import type { JogadorLista } from '../lib/jogadores';
import { formatarMensagemErro } from '../lib/erros';

interface EventosAutomaticosFinanceiroProps {
  jogadores: JogadorLista[];
  onMensagem: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

export function EventosAutomaticosFinanceiro({
  jogadores,
  onMensagem,
}: EventosAutomaticosFinanceiroProps) {
  const [eventos, setEventos] = useState<EventoFinanceiroAutomatico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [edicaoAberta, setEdicaoAberta] = useState<{
    evento: EventoFinanceiroAutomatico | null;
  } | null>(null);
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

  async function salvar(dados: EventoFinanceiroAutomaticoPayload) {
    setSalvando(true);
    try {
      await salvarEventoAutomatico(dados);
      onMensagem(
        'sucesso',
        dados.id ? 'Evento automático atualizado.' : 'Evento automático criado.'
      );
      setEdicaoAberta(null);
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
      if (edicaoAberta?.evento?.id === id) {
        setEdicaoAberta(null);
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
          <Zap className="size-4 shrink-0 text-destaque-texto" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz truncate">
            Eventos automáticos
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setEdicaoAberta({ evento: null })}
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

      {edicaoAberta && (
        <FormEventoAutomatico
          eventoEmEdicao={edicaoAberta.evento}
          jogadores={jogadores}
          salvando={salvando}
          onSalvar={salvar}
          onCancelar={() => setEdicaoAberta(null)}
          onMensagem={onMensagem}
        />
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
                  onClick={() => setEdicaoAberta({ evento: ev })}
                  title="Editar"
                  aria-label={`Editar ${ev.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-destaque-texto hover:border-destaque/50"
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
