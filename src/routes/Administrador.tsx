import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Wallet, ChevronDown, Plus, Check, AlertCircle } from "lucide-react";
import { useAdmin } from "../hooks/useAdmin";
import { Carregando, MensagemEstado } from "../components/Estado";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatarReais, formatarDataLista } from "../lib/formatacao";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
import { PixCopiaECola, BotaoCobrarWhatsApp } from "../components/PixCopiaECola";
import { vibrateLight, vibrateSuccess } from "../lib/haptics";
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
} from "../lib/dividas";

function hojeStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ROTULO_TIPO: Record<TipoDivida, string> = {
  mensalidade: "Mensalidade",
  avulso: "Avulso",
  outro: "Outro",
};

const COR_TIPO: Record<TipoDivida, string> = {
  mensalidade:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  avulso:
    "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  outro:
    "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
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

  // IDs de dívidas em processo de quitação local (feedback visual otimista)
  const [quitandoIds, setQuitandoIds] = useState<Set<number>>(new Set());

  // Diálogo de confirmação para substituição do window.confirm
  const [dialogoConfirmacao, setDialogoConfirmacao] = useState<{
    open: boolean;
    titulo: string;
    mensagem?: string;
    textoConfirmar?: string;
    tomConfirmar?: "destaque" | "perigo";
    acao: () => Promise<void>;
  }>({
    open: false,
    titulo: "",
    acao: async () => {},
  });

  // formulário "adicionar dívida"
  const [fJogador, setFJogador] = useState("");
  const [fTipo, setFTipo] = useState<TipoDivida>("mensalidade");
  const [fValor, setFValor] = useState("90");
  const [fData, setFData] = useState(hojeStr());
  const [fReferencia, setFReferencia] = useState(mesAtualStr());
  const [fDescricao, setFDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [resumo, dividas, jogs] = await Promise.all([
        listarResumoDevedores(),
        listarDividasEmAberto(),
        jogadores.length ? Promise.resolve(jogadores) : listarJogadoresAtivos(),
      ]);
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
        })),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dívidas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function solicitarQuitar(dividaId: number, nome: string, valor: number) {
    vibrateLight();
    setDialogoConfirmacao({
      open: true,
      titulo: "Confirmar Quitação de Dívida",
      mensagem: `Deseja marcar a dívida de ${formatarReais(valor)} de ${nome} como PAGA?`,
      textoConfirmar: "Marcar como Paga",
      tomConfirmar: "destaque",
      acao: async () => {
        setQuitandoIds((prev) => new Set(prev).add(dividaId));
        try {
          await quitarDivida(dividaId);
          vibrateSuccess();
          setOk(`Dívida de ${nome} (${formatarReais(valor)}) quitada com sucesso! ✓`);

          // Feedback visual otimista: remove do estado local
          setGrupos((prev) =>
            prev
              .map((g) => {
                const dividasRestantes = g.dividas.filter((d) => d.id !== dividaId);
                const novoTotal = dividasRestantes.reduce(
                  (acc, d) => acc + Number(d.valor),
                  0,
                );
                return {
                  ...g,
                  dividas: dividasRestantes,
                  total_devido: novoTotal,
                };
              })
              .filter((g) => g.dividas.length > 0),
          );

          await carregar();
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao quitar dívida.");
        } finally {
          setQuitandoIds((prev) => {
            const next = new Set(prev);
            next.delete(dividaId);
            return next;
          });
        }
      },
    });
  }

  function solicitarQuitarTodas(jogadorId: number, nome: string, totalDevido: number) {
    vibrateLight();
    setDialogoConfirmacao({
      open: true,
      titulo: "Quitar TODAS as dívidas",
      mensagem: `Tem certeza que deseja quitar TODAS as pendências de ${nome} no valor total de ${formatarReais(totalDevido)}?`,
      textoConfirmar: "Quitar Todas",
      tomConfirmar: "destaque",
      acao: async () => {
        try {
          await quitarDividasJogador(jogadorId);
          vibrateSuccess();
          setOk(`Todas as dívidas de ${nome} foram quitadas com sucesso! 🎉`);

          // Feedback visual otimista
          setGrupos((prev) => prev.filter((g) => g.jogador_id !== jogadorId));

          await carregar();
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao quitar dívidas.");
        }
      },
    });
  }

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);

    const valor = Number(fValor.replace(",", "."));
    if (!fJogador) {
      setErro("Selecione o jogador.");
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Valor deve ser maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      await registrarDivida({
        jogador_id: Number(fJogador),
        tipo: fTipo,
        valor,
        data_divida: fData || hojeStr(),
        descricao: fDescricao.trim() || undefined,
        referencia: fReferencia.trim() || undefined,
      });
      vibrateSuccess();
      setOk("Dívida adicionada com sucesso.");
      setFValor("90");
      setFData(hojeStr());
      setFReferencia(mesAtualStr());
      setFDescricao("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao adicionar dívida.");
    } finally {
      setSalvando(false);
    }
  }

  const totalGeral = grupos.reduce((s, g) => s + g.total_devido, 0);

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5">
      <button
        onClick={() => {
          vibrateLight();
          navigate(-1);
        }}
        className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer"
      >
        ← voltar
      </button>

      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-[var(--cor-primaria)]" />
        <div>
          <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
            Administração Financeira
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Controle de mensalidades, avulsos e quitações dos atletas
          </p>
        </div>
      </div>

      {erro && (
        <MensagemEstado tipo="erro">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>{erro}</span>
          </div>
        </MensagemEstado>
      )}
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      {/* Chave Pix e Copia & Cola do Administrador */}
      <PixCopiaECola
        permitirEditarChave={true}
        descricao="Chave Pix para recebimento de mensalidades e avulsos"
      />

      {/* Adicionar dívida */}
      <form
        onSubmit={handleAdicionar}
        className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-4 shadow-xs"
      >
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
          Adicionar Débito / Mensalidade
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Jogador
            </span>
            <select
              value={fJogador}
              onChange={(e) => setFJogador(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 cursor-pointer"
            >
              <option value="">Selecione…</option>
              {jogadores.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nome}
                  {j.is_mensalista ? " (mensalista)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Tipo
            </span>
            <select
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value as TipoDivida)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 cursor-pointer"
            >
              {TIPOS_DIVIDA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Valor (R$)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={fValor}
              onChange={(e) => setFValor(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              required
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Data
            </span>
            <input
              type="date"
              value={fData}
              onChange={(e) => setFData(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Referência {fTipo === "mensalidade" ? "(mês)" : "(opcional)"}
            </span>
            <input
              type="text"
              value={fReferencia}
              onChange={(e) => setFReferencia(e.target.value)}
              placeholder="ex.: 2026-08"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>

          <label className="block col-span-2">
            <span className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Descrição (opcional)
            </span>
            <input
              type="text"
              value={fDescricao}
              onChange={(e) => setFDescricao(e.target.value)}
              placeholder="ex.: Mensalidade Agosto/2026"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 dark:bg-green-600 px-4 py-2.5 font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer"
        >
          <Plus className="size-4" />
          {salvando ? "Adicionando…" : "Adicionar Débito"}
        </button>
      </form>

      {/* Dívidas em aberto */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Pendências em Aberto
          </h3>
          <span className="text-sm font-extrabold text-[var(--cor-destaque)]">
            Total: {formatarReais(totalGeral)}
          </span>
        </div>

        {carregando ? (
          <Carregando>Carregando dívidas…</Carregando>
        ) : grupos.length === 0 ? (
          <MensagemEstado tipo="info">Ninguém devendo 🎉</MensagemEstado>
        ) : (
          <ul className="space-y-2.5">
            {grupos.map((g) => {
              const aberto = expandido === g.jogador_id;
              return (
                <li
                  key={g.jogador_id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs"
                >
                  {/* Cabeçalho Desacoplado: Botão de Acordeão separado de Botões de Ação */}
                  <div className="flex min-h-[3.5rem] items-center gap-2 px-3.5 py-2.5 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 transition">
                    <button
                      type="button"
                      onClick={() => {
                        vibrateLight();
                        setExpandido(aberto ? null : g.jogador_id);
                      }}
                      aria-expanded={aberto}
                      className="flex flex-1 items-center gap-2.5 text-left min-w-0 cursor-pointer bg-transparent border-0 p-0"
                    >
                      <ChevronDown
                        className={`size-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
                          aberto ? "rotate-180 text-[var(--cor-destaque)]" : ""
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {g.nome}
                          </span>
                          {g.is_mensalista && (
                            <span className="shrink-0 rounded bg-[var(--cor-destaque)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--cor-destaque)]">
                              mensalista
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {g.dividas.length}{" "}
                          {g.dividas.length === 1 ? "dívida" : "dívidas"}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-red-600 dark:text-red-400 pr-1">
                        {formatarReais(g.total_devido)}
                      </span>
                    </button>

                    {/* Botões de Ação Separados (Não aninhados no botão de expandir) */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-neutral-100 dark:border-neutral-800">
                      <BotaoCobrarWhatsApp
                        nome={g.nome}
                        valor={g.total_devido}
                        dividas={g.dividas}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          solicitarQuitarTodas(g.jogador_id, g.nome, g.total_devido)
                        }
                        title="Quitar todas as dívidas deste atleta"
                        className="shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
                      >
                        Quitar todas
                      </button>
                    </div>
                  </div>

                  {/* Itens (drill-down de débitos) */}
                  {aberto && (
                    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40">
                      {g.dividas.map((d) => {
                        const estaQuitando = quitandoIds.has(d.id);
                        return (
                          <li
                            key={d.id}
                            className={`flex items-start gap-2.5 px-3.5 py-3 transition-opacity ${
                              estaQuitando ? "opacity-40 animate-pulse" : "opacity-100"
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${COR_TIPO[d.tipo]}`}
                                >
                                  {ROTULO_TIPO[d.tipo]}
                                </span>
                                {d.referencia && (
                                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                    ref. {d.referencia}
                                  </span>
                                )}
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {formatarDataLista(d.data_divida)}
                                </span>
                              </div>
                              {d.descricao && (
                                <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                                  {d.descricao}
                                </p>
                              )}
                              {d.partida_id && (
                                <Link
                                  to={`/partida/${d.partida_id}`}
                                  className="inline-block text-[11px] font-semibold text-[var(--cor-primaria)] hover:underline"
                                >
                                  ver partida #{d.partida_id} →
                                </Link>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">
                                {formatarReais(Number(d.valor))}
                              </span>
                              <button
                                type="button"
                                disabled={estaQuitando}
                                onClick={() =>
                                  solicitarQuitar(d.id, g.nome, Number(d.valor))
                                }
                                className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 transition cursor-pointer disabled:opacity-50"
                              >
                                <Check className="size-3.5" />
                                <span>{estaQuitando ? "Quitando…" : "Pagar"}</span>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal Dialog de Confirmação Acessível */}
      <ConfirmDialog
        open={dialogoConfirmacao.open}
        onClose={() =>
          setDialogoConfirmacao((prev) => ({ ...prev, open: false }))
        }
        onConfirm={async () => {
          const acao = dialogoConfirmacao.acao;
          setDialogoConfirmacao((prev) => ({ ...prev, open: false }));
          await acao();
        }}
        titulo={dialogoConfirmacao.titulo}
        mensagem={dialogoConfirmacao.mensagem}
        textoConfirmar={dialogoConfirmacao.textoConfirmar ?? "Confirmar"}
        tomConfirmar={dialogoConfirmacao.tomConfirmar ?? "destaque"}
      />
    </div>
  );
}
