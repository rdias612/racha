import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";
import {
  listarTodosJogadores,
  atualizarCaracteristicasJogador,
  isSuperAdmin,
  MAX_MENSALISTAS,
  type JogadorLista,
} from "../lib/jogadores";

import { POSICOES } from "../lib/times";
import { Avatar } from "../components/Avatar";
import { Carregando, MensagemEstado } from "../components/Estado";
import {
  ArrowLeft,
  Users,
  Shield,
  Search,
  Check,
  X,
  Crown,
  UserCheck,
  UserCheck2,
} from "lucide-react";

type FiltroTipo = "todos" | "mensalistas" | "avulsos" | "admins";

export function GestaoJogadores() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");

  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const lista = await listarTodosJogadores();
        setJogadores(lista);
      } catch (err) {
        setMensagemErro(
          err instanceof Error ? err.message : "Erro ao carregar jogadores."
        );
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (!isAdmin) return <Navigate to="/" replace />;

  // Estatísticas do topo
  const totalJogadores = jogadores.length;
  const totalMensalistas = jogadores.filter((j) => j.is_mensalista).length;
  const totalAdmins = jogadores.filter(
    (j) => j.is_admin || isSuperAdmin(j.username)
  ).length;
  const totalSuperAdmins = jogadores.filter((j) =>
    isSuperAdmin(j.username)
  ).length;

  async function alternarMensalista(jogador: JogadorLista) {
    const novoValor = !jogador.is_mensalista;

    if (novoValor && totalMensalistas >= MAX_MENSALISTAS) {
      setMensagemErro(
        `Limite máximo de ${MAX_MENSALISTAS} mensalistas atingido (${totalMensalistas}/${MAX_MENSALISTAS}). Remova o status de mensalista de outro jogador antes de adicionar.`
      );
      return;
    }

    setSalvandoId(jogador.id);
    setMensagemSucesso(null);
    setMensagemErro(null);

    try {
      await atualizarCaracteristicasJogador(jogador.id, jogador.username, {
        is_mensalista: novoValor,
      });

      setJogadores((prev) =>
        prev.map((j) =>
          j.id === jogador.id ? { ...j, is_mensalista: novoValor } : j
        )
      );

      setMensagemSucesso(
        `"${jogador.nome}" agora é ${
          novoValor ? "Mensalista" : "Avulso (Não-mensalista)"
        }.`
      );
    } catch (err) {
      setMensagemErro(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar status de mensalista."
      );
    } finally {
      setSalvandoId(null);
    }
  }

  async function alternarAdmin(jogador: JogadorLista) {
    if (isSuperAdmin(jogador.username)) {
      setMensagemErro(
        `O usuário "${jogador.username}" é Superadmin permanente. O acesso de administrador não pode ser removido.`
      );
      return;
    }

    const novoValor = !jogador.is_admin;
    setSalvandoId(jogador.id);
    setMensagemSucesso(null);
    setMensagemErro(null);

    try {
      await atualizarCaracteristicasJogador(jogador.id, jogador.username, {
        is_admin: novoValor,
      });

      setJogadores((prev) =>
        prev.map((j) =>
          j.id === jogador.id ? { ...j, is_admin: novoValor } : j
        )
      );

      setMensagemSucesso(
        `"${jogador.nome}" ${
          novoValor ? "agora é Administrador" : "não é mais Administrador"
        }.`
      );
    } catch (err) {
      setMensagemErro(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar permissão de admin."
      );
    } finally {
      setSalvandoId(null);
    }
  }

  // Filtragem da lista
  const jogadoresFiltrados = jogadores.filter((j) => {
    const matchBusca =
      j.nome.toLowerCase().includes(busca.toLowerCase()) ||
      j.username.toLowerCase().includes(busca.toLowerCase());

    if (!matchBusca) return false;

    if (filtro === "mensalistas") return j.is_mensalista;
    if (filtro === "avulsos") return !j.is_mensalista;
    if (filtro === "admins") return j.is_admin || isSuperAdmin(j.username);

    return true;
  });

  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  return (
    <div className="px-3 py-4 pb-24 sm:px-4 max-w-3xl mx-auto space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--cor-primaria)]" />
          Gestão de Jogadores
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Gerencie o acesso de administradores e a classificação de mensalistas (limite fixo de {MAX_MENSALISTAS}).
        </p>
      </div>

      {mensagemErro && <MensagemEstado>{mensagemErro}</MensagemEstado>}
      {mensagemSucesso && (
        <MensagemEstado tipo="sucesso">{mensagemSucesso}</MensagemEstado>
      )}

      {limiteAtingido && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-xs">
          <UserCheck2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Limite Máximo Atingido ({MAX_MENSALISTAS}/{MAX_MENSALISTAS} Mensalistas)</span>
            <span className="opacity-90">
              O limite de {MAX_MENSALISTAS} mensalistas foi alcançado. Para definir um novo mensalista, remova o status de um jogador atual.
            </span>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Total
            </span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {totalJogadores}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Mensalistas
              </span>
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {totalMensalistas}
              </span>
              <span className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70">
                / {MAX_MENSALISTAS}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <div className="h-1.5 w-full bg-emerald-200/80 dark:bg-emerald-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  limiteAtingido ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-400"
                }`}
                style={{
                  width: `${Math.min(100, (totalMensalistas / MAX_MENSALISTAS) * 100)}%`,
                }}
              />
            </div>
            <div className="text-[9px] font-medium text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              {limiteAtingido
                ? "Limite lotado"
                : `${MAX_MENSALISTAS - totalMensalistas} vaga(s) livre(s)`}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Admins
            </span>
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {totalAdmins}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Superadmins
            </span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
            {totalSuperAdmins}
          </div>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou @usuário..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Abas de filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFiltro("todos")}
            className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              filtro === "todos"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            Todos ({totalJogadores})
          </button>
          <button
            onClick={() => setFiltro("mensalistas")}
            className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              filtro === "mensalistas"
                ? "bg-emerald-600 text-white dark:bg-emerald-500"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})
          </button>
          <button
            onClick={() => setFiltro("avulsos")}
            className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              filtro === "avulsos"
                ? "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            Avulsos ({totalJogadores - totalMensalistas})
          </button>
          <button
            onClick={() => setFiltro("admins")}
            className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              filtro === "admins"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            Admins ({totalAdmins})
          </button>
        </div>
      </div>

      {/* Lista de Jogadores */}
      {carregando ? (
        <Carregando>Carregando jogadores...</Carregando>
      ) : jogadoresFiltrados.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum jogador encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jogadoresFiltrados.map((j) => {
            const superadmin = isSuperAdmin(j.username);
            const salvando = salvandoId === j.id;
            const bloqMensalista = !j.is_mensalista && limiteAtingido;

            return (
              <div
                key={j.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 p-3.5 shadow-xs space-y-3 transition"
              >
                {/* Linha Superior: Dados do Jogador */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar nome={j.nome} posicao={j.posicao} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                          {j.nome}
                        </span>
                        {superadmin && (
                          <span
                            title="Superadmin permanente"
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0"
                          >
                            <Crown className="w-3 h-3 text-amber-500" />
                            Superadmin
                          </span>
                        )}
                        {!superadmin && j.is_admin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                            <Shield className="w-3 h-3 text-blue-500" />
                            Admin
                          </span>
                        )}
                        {j.is_mensalista ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                            <UserCheck2 className="w-3 h-3 text-emerald-500" />
                            Mensalista
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                            Avulso
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        @{j.username} · {POSICOES[j.posicao]}
                        {j.posicao_b && ` / 2ª ${POSICOES[j.posicao_b]}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha Inferior: Controles de Gestão */}
                <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Toggle Mensalista */}
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => alternarMensalista(j)}
                    title={
                      bloqMensalista
                        ? `Limite de ${MAX_MENSALISTAS} mensalistas atingido`
                        : undefined
                    }
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                      j.is_mensalista
                        ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40"
                        : bloqMensalista
                        ? "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 opacity-80"
                        : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                          j.is_mensalista
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : bloqMensalista
                            ? "border-amber-400 bg-amber-100 dark:bg-amber-950"
                            : "border-neutral-400 bg-white dark:bg-neutral-900"
                        }`}
                      >
                        {j.is_mensalista && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold">Mensalista</span>
                    </div>

                    <span className="text-[11px] font-medium opacity-80">
                      {j.is_mensalista
                        ? "Ativo"
                        : bloqMensalista
                        ? `Lotado (${MAX_MENSALISTAS}/${MAX_MENSALISTAS})`
                        : "Tornar Mensalista"}
                    </span>
                  </button>

                  {/* Toggle Admin */}
                  <button
                    type="button"
                    disabled={salvando || superadmin}
                    onClick={() => alternarAdmin(j)}
                    title={
                      superadmin
                        ? "Superadmin permanente (acesso não pode ser removido)"
                        : undefined
                    }
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                      superadmin
                        ? "border-amber-300/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 opacity-90 cursor-not-allowed"
                        : j.is_admin
                        ? "border-blue-300 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 hover:bg-blue-100/60 dark:hover:bg-blue-950/40"
                        : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                          superadmin
                            ? "bg-amber-500 border-amber-500 text-white"
                            : j.is_admin
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-neutral-400 bg-white dark:bg-neutral-900"
                        }`}
                      >
                        {(superadmin || j.is_admin) && (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>
                      <span className="font-semibold">Administrador</span>
                    </div>

                    <span className="text-[11px] font-medium opacity-80 flex items-center gap-1">
                      {superadmin ? (
                        <>
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span>Superadmin Fixado</span>
                        </>
                      ) : j.is_admin ? (
                        "Ativo"
                      ) : (
                        "Tornar Admin"
                      )}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

