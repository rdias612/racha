import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Wallet,
  ChevronDown,
  Plus,
  Check,
  MessageSquare,
  FileSpreadsheet,
  Copy,
} from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { Badge } from '../components/Badge';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventosAutomaticosFinanceiro } from '../components/EventosAutomaticosFinanceiro';
import { PullToRefresh } from '../components/PullToRefresh';
import { SelectSumula } from '../components/SelectSumula';
import { Snackbar, type TipoSnackbar } from '../components/Snackbar';
import { formatarReais, formatarDataLista } from '../lib/formatacao';
import { isRandomUsername, listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import { BotaoVoltar } from '../components/BotaoVoltar';
import {
  NATUREZAS_LANCAMENTO,
  TIPOS_DIVIDA,
  baixarExcelLancamentos,
  labelTipoDivida,
  listarDividasEmAberto,
  listarLancamentosPorPeriodo,
  listarResumoDevedores,
  quitarDivida,
  quitarDividasJogador,
  registrarDivida,
  type Divida,
  type DividaPorJogador,
  type NaturezaLancamento,
  type TipoDivida,
} from '../lib/dividas';

function hojeStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function primeiroDiaMesStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const COR_TIPO: Record<TipoDivida, string> = {
  mensalidade: 'bg-destaque/15 text-destaque border-destaque/40',
  avulso: 'bg-ok/15 text-ok border-ok/40',
  goleiro: 'bg-campo/20 text-giz border-borda',
  campo: 'bg-superficie-2 text-giz border-borda',
  eventos: 'bg-destaque/10 text-destaque border-destaque/30',
  outro: 'bg-superficie-2 text-giz-fraco border-borda',
};

export function Administrador() {
  const isAdmin = useAdmin();

  const [grupos, setGrupos] = useState<DividaPorJogador[]>([]);
  const [despesas, setDespesas] = useState<Divida[]>([]);
  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{
    visivel: boolean;
    tipo: TipoSnackbar;
    mensagem: string;
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' });
  const [confirmacao, setConfirmacao] = useState<{
    open: boolean;
    titulo: string;
    mensagem: string;
    onConfirm: () => void;
  } | null>(null);

  function mostrarSnackbar(tipo: TipoSnackbar, mensagem: string) {
    setSnackbar({ visivel: true, tipo, mensagem });
  }

  const [fNatureza, setFNatureza] = useState<NaturezaLancamento>('receita');
  const [fJogador, setFJogador] = useState('');
  const [fTipo, setFTipo] = useState<TipoDivida>('mensalidade');
  const [fValor, setFValor] = useState('90');
  const [fData, setFData] = useState(hojeStr());
  const [fReferencia, setFReferencia] = useState(mesAtualStr());
  const [fDescricao, setFDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [exportDe, setExportDe] = useState(primeiroDiaMesStr());
  const [exportAte, setExportAte] = useState(hojeStr());
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!isAdmin) return;
      setCarregando(true);
      setErro(null);
      try {
        // Jogadores carregam à parte: falha na coluna `natureza` (migração 078)
        // não pode esvaziar o dropdown do formulário.
        const [rResumo, rLancamentos, rJogs] = await Promise.allSettled([
          listarResumoDevedores(),
          listarDividasEmAberto(),
          listarJogadoresAtivos(),
        ]);
        if (isAtivo && !isAtivo()) return;

        if (rJogs.status === 'fulfilled') {
          setJogadores(rJogs.value.filter((j) => !isRandomUsername(j.username)));
        } else {
          setJogadores([]);
        }

        const erros: string[] = [];
        if (rJogs.status === 'rejected') {
          erros.push(
            rJogs.reason instanceof Error ? rJogs.reason.message : 'Erro ao carregar jogadores.'
          );
        }

        if (rResumo.status === 'rejected' || rLancamentos.status === 'rejected') {
          const motivo =
            rLancamentos.status === 'rejected'
              ? rLancamentos.reason
              : rResumo.status === 'rejected'
                ? rResumo.reason
                : null;
          const msg = motivo instanceof Error ? motivo.message : 'Erro ao carregar lançamentos.';
          erros.push(
            /natureza|column|schema|PGRST/i.test(msg)
              ? 'Aplique a migration 078_dividas_natureza_despesa.sql no Supabase para receitas/despesas.'
              : msg
          );
          setGrupos([]);
          setDespesas([]);
        } else {
          const resumo = rResumo.value;
          const lancamentos = rLancamentos.value;
          const receitas = lancamentos.filter((d) => d.natureza !== 'despesa');
          const despesasAbertas = lancamentos.filter((d) => d.natureza === 'despesa');
          setDespesas(despesasAbertas);

          const itensPorJogador = new Map<number, Divida[]>();
          for (const d of receitas) {
            if (d.jogador_id == null) continue;
            const arr = itensPorJogador.get(d.jogador_id) ?? [];
            arr.push(d);
            itensPorJogador.set(d.jogador_id, arr);
          }
          setGrupos(
            resumo.map((r) => ({
              jogador_id: r.jogador_id,
              username: r.username,
              is_mensalista: r.is_mensalista,
              total_devido: Number(r.total_devido),
              dividas: itensPorJogador.get(r.jogador_id) ?? [],
            }))
          );
        }

        if (erros.length > 0) setErro(erros.join(' '));
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar lançamentos.');
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

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

  function handleQuitar(e: React.MouseEvent, dividaId: number, username: string) {
    e.stopPropagation();
    setConfirmacao({
      open: true,
      titulo: 'Quitar lançamento?',
      mensagem: `Marcar o lançamento de @${username} como quitado na súmula financeira?`,
      onConfirm: async () => {
        setConfirmacao(null);
        const gruposAnteriores = grupos;
        const despesasAnteriores = despesas;

        setGrupos((prev) =>
          prev
            .map((g) => {
              const dividaAlvo = g.dividas.find((d) => d.id === dividaId);
              if (!dividaAlvo) return g;
              const novasDividas = g.dividas.filter((d) => d.id !== dividaId);
              const novoTotal = Math.max(0, g.total_devido - Number(dividaAlvo.valor));
              return {
                ...g,
                total_devido: novoTotal,
                dividas: novasDividas,
              };
            })
            .filter((g) => g.dividas.length > 0 && g.total_devido > 0)
        );
        setDespesas((prev) => prev.filter((d) => d.id !== dividaId));

        try {
          await quitarDivida(dividaId);
          mostrarSnackbar('sucesso', 'Lançamento marcado como quitado.');
          await carregar();
        } catch (err) {
          setGrupos(gruposAnteriores);
          setDespesas(despesasAnteriores);
          mostrarSnackbar(
            'erro',
            err instanceof Error ? err.message : 'Erro ao quitar lançamento.'
          );
        }
      },
    });
  }

  function handleQuitarTodas(e: React.MouseEvent, jogadorId: number, username: string) {
    e.stopPropagation();
    setConfirmacao({
      open: true,
      titulo: 'Quitar todas as receitas?',
      mensagem: `Quitar TODAS as pendências em aberto de @${username}?`,
      onConfirm: async () => {
        setConfirmacao(null);
        const gruposAnteriores = grupos;

        setGrupos((prev) => prev.filter((g) => g.jogador_id !== jogadorId));
        if (expandido === jogadorId) {
          setExpandido(null);
        }

        try {
          await quitarDividasJogador(jogadorId);
          mostrarSnackbar('sucesso', `Receitas de @${username} quitadas.`);
          await carregar();
        } catch (err) {
          setGrupos(gruposAnteriores);
          mostrarSnackbar('erro', err instanceof Error ? err.message : 'Erro ao quitar receitas.');
        }
      },
    });
  }

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const valor = Number(fValor.replace(',', '.'));
    if (fNatureza === 'receita' && !fJogador) {
      setErro('Selecione o jogador da receita.');
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Valor deve ser maior que zero.');
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
      mostrarSnackbar(
        'sucesso',
        fNatureza === 'despesa' ? 'Despesa registrada.' : 'Receita registrada.'
      );
      setFDescricao('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar lançamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExportar() {
    if (!exportDe || !exportAte) {
      mostrarSnackbar('erro', 'Informe o período de exportação.');
      return;
    }
    if (exportDe > exportAte) {
      mostrarSnackbar('erro', 'A data inicial não pode ser maior que a final.');
      return;
    }

    setExportando(true);
    try {
      const lancamentos = await listarLancamentosPorPeriodo(exportDe, exportAte);
      if (lancamentos.length === 0) {
        mostrarSnackbar('erro', 'Nenhum lançamento nesse período.');
        return;
      }
      baixarExcelLancamentos(lancamentos, exportDe, exportAte);
      mostrarSnackbar(
        'sucesso',
        `Excel gerado com ${lancamentos.length} lançamento${lancamentos.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      mostrarSnackbar('erro', err instanceof Error ? err.message : 'Erro ao exportar o período.');
    } finally {
      setExportando(false);
    }
  }

  function copiarLembreteWhatsApp(e: React.MouseEvent, g: DividaPorJogador) {
    e.stopPropagation();
    const linhas = g.dividas
      .map(
        (d) =>
          `• ${labelTipoDivida(d.tipo)} (${formatarDataLista(d.data_divida)}): ${formatarReais(Number(d.valor))}${d.descricao ? ` — ${d.descricao}` : ''}`
      )
      .join('\n');

    const texto = `⚽ *Súmula Financeira — Racha Gragoatá*\n\nFala @${g.username}! Segue o resumo das pendências em aberto:\n\n${linhas}\n\n*Total em aberto: ${formatarReais(g.total_devido)}*\n\nValeu pela força e nos vemos quinta! 👊`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          mostrarSnackbar('sucesso', `Lembrete para @${g.username} copiado com sucesso!`);
        })
        .catch(() => {
          mostrarSnackbar('erro', 'Não foi possível copiar a mensagem.');
        });
    }
  }

  const totalReceitas = grupos.reduce((acc, g) => acc + g.total_devido, 0);
  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <PullToRefresh onRefresh={() => carregar()}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
        <BotaoVoltar fallback="/" />

        <div className="flex items-center justify-between sumula-header pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-destaque" />
            <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
              Controle Financeiro
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Súmula CBO
          </span>
        </div>

        {erro && <MensagemEstado>{erro}</MensagemEstado>}

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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className={`w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs shadow-carimbo transition active:translate-y-px disabled:opacity-50 ${
              fNatureza === 'despesa'
                ? 'border-perigo bg-perigo text-white'
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

        {/* Exportação do histórico */}
        <section className="space-y-3 rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-destaque" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
              Exportar período
            </h3>
          </div>
          <p className="text-xs text-giz-fraco font-sans">
            Baixa o histórico completo (receitas e despesas, quitados e em aberto) da tabela
            financeira no intervalo escolhido.
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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
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
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo transition active:translate-y-px hover:border-destaque disabled:opacity-50"
          >
            <FileSpreadsheet className="size-4 text-destaque" />
            {exportando ? 'Gerando…' : 'Exportar Excel'}
          </button>
        </section>

        <EventosAutomaticosFinanceiro
          jogadores={jogadores}
          onMensagem={(tipo, mensagem) => mostrarSnackbar(tipo, mensagem)}
        />

        {/* Receitas em aberto (por jogador) */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between sumula-header pb-1.5">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
              Receitas em aberto
            </h3>
            <span className="font-mono text-base font-bold text-ok tabular-nums">
              {formatarReais(totalReceitas)}
            </span>
          </div>

          {carregando && grupos.length === 0 && despesas.length === 0 ? (
            <Carregando>Carregando lançamentos…</Carregando>
          ) : grupos.length === 0 ? (
            <MensagemEstado tipo="info">
              Nenhuma receita em aberto. Todo mundo em dia com a quinta.
            </MensagemEstado>
          ) : (
            <ul className="space-y-2">
              {grupos.map((g) => {
                const aberto = expandido === g.jogador_id;
                return (
                  <li
                    key={g.jogador_id}
                    className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandido(aberto ? null : g.jogador_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandido(aberto ? null : g.jogador_id);
                        }
                      }}
                      className="flex min-h-[44px] items-center gap-2 px-3 py-2 cursor-pointer hover:bg-superficie-2 transition"
                    >
                      <ChevronDown
                        className={`size-4 shrink-0 text-destaque transition-transform ${
                          aberto ? 'rotate-180' : ''
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-giz">@{g.username}</span>
                          {g.is_mensalista && (
                            <span className="shrink-0 rounded-[2px] border border-destaque/40 bg-destaque/15 px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold text-destaque">
                              mensalista
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-giz-fraco">
                          {g.dividas.length} {g.dividas.length === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold text-perigo tabular-nums">
                        {formatarReais(g.total_devido)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => copiarLembreteWhatsApp(e, g)}
                          title="Copiar lembrete WhatsApp"
                          aria-label={`Copiar cobrança de @${g.username} para WhatsApp`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 p-2 text-giz-fraco hover:text-destaque hover:border-destaque/50 transition"
                        >
                          <MessageSquare className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuitarTodas(e, g.jogador_id, g.username)}
                          title="Quitar todas"
                          className="min-h-[44px] rounded-[3px] border border-borda bg-superficie-2 px-2.5 py-1 text-xs font-display uppercase tracking-wider font-semibold text-giz hover:border-destaque transition"
                        >
                          Quitar todas
                        </button>
                      </div>
                    </div>

                    {aberto && (
                      <ul className="divide-y divide-borda border-t border-borda bg-fundo/40">
                        {g.dividas.map((d) => (
                          <li key={d.id} className="flex items-start gap-2 px-3 py-2.5">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variante="ok">Receita</Badge>
                                <span
                                  className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold ${COR_TIPO[d.tipo]}`}
                                >
                                  {labelTipoDivida(d.tipo)}
                                </span>
                                {d.referencia && (
                                  <span className="text-[11px] font-mono text-giz-fraco">
                                    ref. {d.referencia}
                                  </span>
                                )}
                                <span className="text-[11px] font-mono text-giz-fraco">
                                  {formatarDataLista(d.data_divida)}
                                </span>
                              </div>
                              {d.descricao && <p className="text-xs text-giz">{d.descricao}</p>}
                              {d.partida_id && (
                                <Link
                                  to={`/partida/${d.partida_id}`}
                                  className="inline-block text-[11px] font-mono text-destaque hover:underline"
                                >
                                  ver partida →
                                </Link>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span className="font-mono text-sm font-bold text-ok tabular-nums">
                                +{formatarReais(Number(d.valor))}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleQuitar(e, d.id, g.username)}
                                className="min-h-[44px] flex items-center gap-1 rounded-[3px] border border-ok bg-ok px-3 py-1.5 text-xs font-display uppercase tracking-wider font-bold text-white shadow-xs hover:brightness-110"
                              >
                                <Check className="size-3.5" />
                                Pagar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Despesas em aberto */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between sumula-header pb-1.5">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
              Despesas em aberto
            </h3>
            <span className="font-mono text-base font-bold text-perigo tabular-nums">
              {formatarReais(totalDespesas)}
            </span>
          </div>

          {!carregando && despesas.length === 0 ? (
            <MensagemEstado tipo="info">Nenhuma despesa pendente no caixa.</MensagemEstado>
          ) : despesas.length > 0 ? (
            <ul className="divide-y divide-borda/40 border-y border-borda bg-superficie">
              {despesas.map((d) => {
                const rotulo =
                  d.jogadores?.username != null
                    ? `@${d.jogadores.username}`
                    : d.jogador_id != null
                      ? `#${d.jogador_id}`
                      : 'Caixa do racha';
                return (
                  <li key={d.id} className="flex items-start gap-2 px-3 py-2.5 min-h-[44px]">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variante="perigo">Despesa</Badge>
                        <span
                          className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold ${COR_TIPO[d.tipo]}`}
                        >
                          {labelTipoDivida(d.tipo)}
                        </span>
                        {d.referencia && (
                          <span className="text-[11px] font-mono text-giz-fraco">
                            ref. {d.referencia}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-giz-fraco">
                          {formatarDataLista(d.data_divida)}
                        </span>
                      </div>
                      <p className="text-sm font-display font-bold uppercase tracking-wide text-giz">
                        {rotulo}
                      </p>
                      {d.descricao && <p className="text-xs text-giz-fraco">{d.descricao}</p>}

                      {d.jogadores?.chave_pix ? (
                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono text-giz bg-superficie-2 border border-borda px-2 py-1 rounded-[2px] truncate max-w-[180px] sm:max-w-xs">
                            PIX: {d.jogadores.chave_pix}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(d.jogadores!.chave_pix!);
                              mostrarSnackbar('sucesso', 'Chave PIX copiada!');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-mono text-destaque hover:underline min-h-[44px] px-2 py-1 active:translate-y-px transition focus-visible:outline-2 focus-visible:outline-destaque"
                          >
                            <Copy className="size-3.5" />
                            <span>Copiar PIX</span>
                          </button>
                        </div>
                      ) : d.tipo === 'goleiro' ? (
                        <p className="text-[11px] font-mono text-giz-fraco italic pt-0.5">
                          Chave PIX não cadastrada
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-mono text-sm font-bold text-perigo tabular-nums">
                        −{formatarReais(Number(d.valor))}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleQuitar(e, d.id, d.jogadores?.username ?? 'caixa')}
                        className="min-h-[44px] flex items-center gap-1 rounded-[3px] border border-borda bg-superficie-2 px-3 py-1.5 text-xs font-display uppercase tracking-wider font-bold text-giz hover:border-perigo hover:text-perigo transition"
                      >
                        <Check className="size-3.5" />
                        Pagar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {confirmacao && (
          <ConfirmDialog
            open={confirmacao.open}
            onClose={() => setConfirmacao(null)}
            onConfirm={confirmacao.onConfirm}
            titulo={confirmacao.titulo}
            mensagem={confirmacao.mensagem}
          />
        )}

        <Snackbar
          mensagem={snackbar.mensagem}
          tipo={snackbar.tipo}
          visivel={snackbar.visivel}
          onFechar={() => setSnackbar((s) => ({ ...s, visivel: false }))}
        />
      </div>
    </PullToRefresh>
  );
}
