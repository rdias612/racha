import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Wallet, ChevronDown, Plus, Check } from "lucide-react";
import { useAdmin } from "../hooks/useAdmin";
import { Carregando, MensagemEstado } from "../components/Estado";
import { formatarReais, formatarDataLista } from "../lib/formatacao";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
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

  async function handleQuitar(e: React.MouseEvent, dividaId: number, nome: string) {
    e.stopPropagation();
    if (!window.confirm(`Marcar a dívida de ${nome} como paga?`)) return;
    try {
      await quitarDivida(dividaId);
      setOk("Dívida marcada como paga.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao quitar dívida.");
    }
  }

  async function handleQuitarTodas(e: React.MouseEvent, jogadorId: number, nome: string) {
    e.stopPropagation();
    if (!window.confirm(`Quitar TODAS as dívidas em aberto de ${nome}?`)) return;
    try {
      await quitarDividasJogador(jogadorId);
      setOk(`Dívidas de ${nome} quitadas.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao quitar dívidas.");
    }
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
      setOk("Dívida adicionada.");
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
        onClick={() => navigate(-1)}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-primaria" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Administrador
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Controle de dívidas dos jogadores
          </p>
        </div>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      {/* Adicionar dívida */}
      <form
        onSubmit={handleAdicionar}
        className="space-y-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3"
      >
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Adicionar dívida
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Jogador
            </span>
            <select
              value={fJogador}
              onChange={(e) => setFJogador(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
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
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Tipo
            </span>
            <select
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value as TipoDivida)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            >
              {TIPOS_DIVIDA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Valor (R$)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={fValor}
              onChange={(e) => setFValor(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              required
            />
          </label>

          <label className="block">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Data
            </span>
            <input
              type="date"
              value={fData}
              onChange={(e) => setFData(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Referência {fTipo === "mensalidade" ? "(mês)" : "(opcional)"}
            </span>
            <input
              type="text"
              value={fReferencia}
              onChange={(e) => setFReferencia(e.target.value)}
              placeholder="ex.: 2026-08"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>

          <label className="block col-span-2">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Descrição (opcional)
            </span>
            <input
              type="text"
              value={fDescricao}
              onChange={(e) => setFDescricao(e.target.value)}
              placeholder="ex.: Mensalidade Agosto/2026"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 dark:bg-green-600 px-4 py-2.5 font-medium text-white disabled:opacity-50 transition"
        >
          <Plus className="size-4" />
          {salvando ? "Adicionando…" : "Adicionar dívida"}
        </button>
      </form>

      {/* Dívidas em aberto */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Dívidas em aberto
          </h3>
          <span className="text-sm font-semibold text-destaque">
            {formatarReais(totalGeral)}
          </span>
        </div>

        {carregando ? (
          <Carregando>Carregando dívidas…</Carregando>
        ) : grupos.length === 0 ? (
          <MensagemEstado tipo="info">Ninguém devendo 🎉</MensagemEstado>
        ) : (
          <ul className="space-y-2">
            {grupos.map((g) => {
              const aberto = expandido === g.jogador_id;
              return (
                <li
                  key={g.jogador_id}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
                >
                  {/* Cabeçalho do acordeão */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandido(aberto ? null : g.jogador_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandido(aberto ? null : g.jogador_id);
                      }
                    }}
                    className="flex min-h-[3.5rem] items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-neutral-400 transition-transform ${
                        aberto ? "rotate-180" : ""
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {g.nome}
                        </span>
                        {g.is_mensalista && (
                          <span className="shrink-0 rounded bg-destaque/15 px-1.5 py-0.5 text-[10px] font-medium text-destaque">
                            mensalista
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {g.dividas.length}{" "}
                        {g.dividas.length === 1 ? "dívida" : "dívidas"}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-red-600 dark:text-red-400">
                      {formatarReais(g.total_devido)}
                    </span>
                    <button
                      onClick={(e) => handleQuitarTodas(e, g.jogador_id, g.nome)}
                      title="Quitar todas"
                      className="shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Quitar todas
                    </button>
                  </div>

                  {/* Itens (drill-down) */}
                  {aberto && (
                    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800">
                      {g.dividas.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-start gap-2 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${COR_TIPO[d.tipo]}`}
                              >
                                {ROTULO_TIPO[d.tipo]}
                              </span>
                              {d.referencia && (
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  ref. {d.referencia}
                                </span>
                              )}
                              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                {formatarDataLista(d.data_divida)}
                              </span>
                            </div>
                            {d.descricao && (
                              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                                {d.descricao}
                              </p>
                            )}
                            {d.partida_id && (
                              <Link
                                to={`/partida/${d.partida_id}`}
                                className="inline-block text-[11px] text-primaria hover:underline"
                              >
                                ver partida →
                              </Link>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {formatarReais(Number(d.valor))}
                            </span>
                            <button
                              onClick={(e) => handleQuitar(e, d.id, g.nome)}
                              className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 px-2 py-1 text-xs font-medium text-white"
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
    </div>
  );
}
