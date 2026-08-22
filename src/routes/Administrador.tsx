import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Wallet, ChevronDown, Plus, Check, MessageSquare } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar, type TipoSnackbar } from '../components/Snackbar';
import { formatarReais, formatarDataLista } from '../lib/formatacao';
import { listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import { voltar } from '../lib/navegacao';
import {
  TIPOS_DIVIDA,
  listarDividasEmAberto,
  listarResumoDevedores,
  quitarDivida,
  quitarDividasJogador,
  registrarDivida,
  type Divida,
  type DividaPorJogador,
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

const COR_TIPO: Record<TipoDivida, string> = {
  mensalidade: 'bg-destaque/15 text-destaque border-destaque/40',
  avulso: 'bg-ok/15 text-ok border-ok/40',
  outro: 'bg-superficie-2 text-giz-fraco border-borda',
};

export function Administrador() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [grupos, setGrupos] = useState<DividaPorJogador[]>([]);
  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
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

  // formulário "adicionar dívida"
  const [fJogador, setFJogador] = useState('');
  const [fTipo, setFTipo] = useState<TipoDivida>('mensalidade');
  const [fValor, setFValor] = useState('90');
  const [fData, setFData] = useState(hojeStr());
  const [fReferencia, setFReferencia] = useState(mesAtualStr());
  const [fDescricao, setFDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!isAdmin) return;
      setCarregando(true);
      setErro(null);
      try {
        const [resumo, dividas, jogs] = await Promise.all([
          listarResumoDevedores(),
          listarDividasEmAberto(),
          jogadores.length ? Promise.resolve(jogadores) : listarJogadoresAtivos(),
        ]);
        if (isAtivo && !isAtivo()) return;
        if (!jogadores.length) setJogadores(jogs);

        // A view `dividas_resumo` dita totais e ordem; os itens (drill-down) casam pelo jogador_id.
        const itensPorJogador = new Map<number, Divida[]>();
        for (const d of dividas) {
          const arr = itensPorJogador.get(d.jogador_id) ?? [];
          arr.push(d);
          itensPorJogador.set(d.jogador_id, arr);
        }
        setGrupos(
          resumo.map((r) => ({
            jogador_id: r.jogador_id,
            nome: r.nome,
            username: r.username,
            is_mensalista: r.is_mensalista,
            total_devido: Number(r.total_devido),
            dividas: itensPorJogador.get(r.jogador_id) ?? [],
          }))
        );
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar dívidas.');
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [isAdmin, jogadores]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

  function handleQuitar(e: React.MouseEvent, dividaId: number, nome: string) {
    e.stopPropagation();
    setConfirmacao({
      open: true,
      titulo: 'Quitar dívida?',
      mensagem: `Marcar a dívida de ${nome} como paga na súmula financeira?`,
      onConfirm: async () => {
        setConfirmacao(null);
        try {
          await quitarDivida(dividaId);
          setOk('Dívida marcada como paga.');
          await carregar();
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Erro ao quitar dívida.');
        }
      },
    });
  }

  function handleQuitarTodas(e: React.MouseEvent, jogadorId: number, nome: string) {
    e.stopPropagation();
    setConfirmacao({
      open: true,
      titulo: 'Quitar todas as dívidas?',
      mensagem: `Quitar TODAS as pendências em aberto de ${nome}?`,
      onConfirm: async () => {
        setConfirmacao(null);
        try {
          await quitarDividasJogador(jogadorId);
          setOk(`Dívidas de ${nome} quitadas.`);
          await carregar();
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Erro ao quitar dívidas.');
        }
      },
    });
  }

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);

    const valor = Number(fValor.replace(',', '.'));
    if (!fJogador) {
      setErro('Selecione o jogador.');
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Valor deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await registrarDivida({
        jogador_id: Number(fJogador),
        tipo: fTipo,
        valor,
        data_divida: fData,
        referencia: fReferencia ? fReferencia.trim() : undefined,
        descricao: fDescricao ? fDescricao.trim() : undefined,
      });
      setOk('Dívida registrada com sucesso.');
      setFDescricao('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar dívida.');
    } finally {
      setSalvando(false);
    }
  }

  function copiarLembreteWhatsApp(e: React.MouseEvent, g: DividaPorJogador) {
    e.stopPropagation();
    const linhas = g.dividas
      .map(
        (d) =>
          `• ${d.tipo === 'mensalidade' ? 'Mensalidade' : d.tipo === 'avulso' ? 'Avulso' : 'Taxa'} (${formatarDataLista(d.data_divida)}): ${formatarReais(Number(d.valor))}${d.descricao ? ` — ${d.descricao}` : ''}`
      )
      .join('\n');

    const texto = `⚽ *Súmula Financeira — Racha Gragoatá*\n\nFala ${g.nome}! Segue o resumo das pendências em aberto:\n\n${linhas}\n\n*Total em aberto: ${formatarReais(g.total_devido)}*\n\nValeu pela força e nos vemos quinta! 👊`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          setSnackbar({
            visivel: true,
            tipo: 'sucesso',
            mensagem: `Lembrete para ${g.nome} copiado com sucesso!`,
          });
        })
        .catch(() => {
          setSnackbar({
            visivel: true,
            tipo: 'erro',
            mensagem: 'Não foi possível copiar a mensagem.',
          });
        });
    }
  }

  const totalGeral = grupos.reduce((acc, g) => acc + g.total_devido, 0);

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <button
        onClick={() => voltar(navigate, '/')}
        className="text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        ← voltar
      </button>

      {/* Cabeçalho da Súmula Financeira */}
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
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      {/* Adicionar dívida */}
      <form
        onSubmit={handleAdicionar}
        className="space-y-3 rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo"
      >
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Adicionar Dívida / Mensalidade
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
              Jogador
            </span>
            <select
              value={fJogador}
              onChange={(e) => setFJogador(e.target.value)}
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs"
            >
              <option value="">Selecione…</option>
              {jogadores.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nome}
                  {j.is_mensalista ? ' (mensalista)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
              Tipo
            </span>
            <select
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value as TipoDivida)}
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs"
            >
              {TIPOS_DIVIDA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs"
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
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs"
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
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs"
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
              placeholder="ex.: Mensalidade Agosto/2026"
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px disabled:opacity-50"
        >
          <Plus className="size-4" />
          {salvando ? 'Adicionando…' : 'Adicionar dívida'}
        </button>
      </form>

      {/* Dívidas em aberto */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between sumula-header pb-1.5">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            Dívidas em aberto
          </h3>
          <span className="font-mono text-base font-bold text-destaque tabular-nums">
            {formatarReais(totalGeral)}
          </span>
        </div>

        {carregando ? (
          <Carregando>Carregando dívidas…</Carregando>
        ) : grupos.length === 0 ? (
          <MensagemEstado tipo="info">
            Ninguém devendo 🎉 Todo mundo em dia com a quinta.
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
                  {/* Cabeçalho do acordeão */}
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
                        <span className="truncate text-sm font-bold text-giz">{g.nome}</span>
                        {g.is_mensalista && (
                          <span className="shrink-0 rounded-[2px] border border-destaque/40 bg-destaque/15 px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold text-destaque">
                            mensalista
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-giz-fraco">
                        {g.dividas.length} {g.dividas.length === 1 ? 'dívida' : 'dívidas'}
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
                        aria-label={`Copiar cobrança de ${g.nome} para WhatsApp`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 p-2 text-giz-fraco hover:text-destaque hover:border-destaque/50 transition"
                      >
                        <MessageSquare className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleQuitarTodas(e, g.jogador_id, g.nome)}
                        title="Quitar todas"
                        className="min-h-[44px] rounded-[3px] border border-borda bg-superficie-2 px-2.5 py-1 text-xs font-display uppercase tracking-wider font-semibold text-giz hover:border-destaque transition"
                      >
                        Quitar todas
                      </button>
                    </div>
                  </div>

                  {/* Itens (drill-down) */}
                  {aberto && (
                    <ul className="divide-y divide-borda border-t border-borda bg-fundo/40">
                      {g.dividas.map((d) => (
                        <li key={d.id} className="flex items-start gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold ${COR_TIPO[d.tipo]}`}
                              >
                                {TIPOS_DIVIDA.find((t) => t.value === d.tipo)?.label ?? d.tipo}
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
                            <span className="font-mono text-sm font-bold text-giz tabular-nums">
                              {formatarReais(Number(d.valor))}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleQuitar(e, d.id, g.nome)}
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
  );
}
