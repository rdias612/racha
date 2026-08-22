import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";
import {
  listarTodosJogadores,
  atualizarCaracteristicasJogador,
  resetarSenhaJogador,
  isSuperAdmin,
  MAX_MENSALISTAS,
  type JogadorLista,
} from "../lib/jogadores";
import { POSICOES } from "../lib/times";
import { Avatar } from "../components/Avatar";
import { MensagemEstado } from "../components/Estado";
import { SkeletonGestao } from "../components/Skeletons";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Snackbar, type TipoSnackbar } from "../components/Snackbar";
import { voltar } from "../lib/navegacao";
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
  Save,
  RotateCcw,
  Sparkles,
  KeyRound,
} from "lucide-react";

type FiltroTipo = "todos" | "mensalistas" | "avulsos" | "admins";

interface AlteracaoRascunho {
  is_mensalista: boolean;
  is_admin: boolean;
}

export function GestaoJogadores() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");

  // Rascunho de alterações pendentes { [jogadorId]: { is_mensalista, is_admin } }
  const [rascunhos, setRascunhos] = useState<Record<number, AlteracaoRascunho>>({});

  const [salvandoLote, setSalvandoLote] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Reset de senha (ação imediata, fora do fluxo de rascunhos)
  const [resetandoId, setResetandoId] = useState<number | null>(null);
  const [alvoReset, setAlvoReset] = useState<JogadorLista | null>(null);
  const [snackbar, setSnackbar] = useState<{
    visivel: boolean;
    tipo: TipoSnackbar;
    mensagem: string;
  }>({ visivel: false, tipo: "sucesso", mensagem: "" });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const lista = await listarTodosJogadores();
        if (ativo) setJogadores(lista);
      } catch (err) {
        if (ativo) {
          setMensagemErro(
            err instanceof Error ? err.message : "Erro ao carregar jogadores."
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  if (!isAdmin) return <Navigate to="/" replace />;

  // Função para obter o estado de um jogador (original mesclado com rascunho)
  function obterEstadoDraft(j: JogadorLista): JogadorLista {
    const draft = rascunhos[j.id];
    if (!draft) return j;
    return {
      ...j,
      is_mensalista: draft.is_mensalista,
      is_admin: isSuperAdmin(j.username) ? true : draft.is_admin,
    };
  }

  // Estatísticas calculadas sobre o estado de Rascunho (em tempo real)
  const jogadoresDraft = jogadores.map(obterEstadoDraft);
  const totalJogadores = jogadores.length;
  const totalMensalistas = jogadoresDraft.filter((j) => j.is_mensalista).length;
  const totalAdmins = jogadoresDraft.filter(
    (j) => j.is_admin || isSuperAdmin(j.username)
  ).length;
  const totalSuperAdmins = jogadoresDraft.filter((j) =>
    isSuperAdmin(j.username)
  ).length;

  const qtdModificacoes = Object.keys(rascunhos).length;
  const temAlteracoes = qtdModificacoes > 0;
  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  function alternarMensalistaDraft(jOriginal: JogadorLista) {
    const estadoAtual = obterEstadoDraft(jOriginal);
    const novoMensalista = !estadoAtual.is_mensalista;

    // Se estiver tentando virar mensalista e já atingiu limite
    if (novoMensalista && totalMensalistas >= MAX_MENSALISTAS) {
      setMensagemErro(
        `Limite máximo de ${MAX_MENSALISTAS} mensalistas atingido (${totalMensalistas}/${MAX_MENSALISTAS}). Remova o status de outro jogador antes de adicionar.`
      );
      return;
    }

    setMensagemErro(null);
    setMensagemSucesso(null);

    let novoAdmin = estadoAtual.is_admin;

    // Regra: Se estiver deixando de ser mensalista, deixa obrigatoriamente de ser admin (exceto superadmin)
    if (!novoMensalista && estadoAtual.is_admin && !isSuperAdmin(jOriginal.username)) {
      novoAdmin = false;
      setMensagemSucesso(
        `O status de administrador de "${jOriginal.nome}" foi desativado (apenas mensalistas podem ser admins).`
      );
    }

    // Se o novo estado voltar a ser idêntico ao original, remove do rascunho
    if (
      novoMensalista === jOriginal.is_mensalista &&
      novoAdmin === jOriginal.is_admin
    ) {
      setRascunhos((prev) => {
        const cop = { ...prev };
        delete cop[jOriginal.id];
        return cop;
      });
    } else {
      setRascunhos((prev) => ({
        ...prev,
        [jOriginal.id]: {
          is_mensalista: novoMensalista,
          is_admin: novoAdmin,
        },
      }));
    }
  }

  function alternarAdminDraft(jOriginal: JogadorLista) {
    if (isSuperAdmin(jOriginal.username)) {
      setMensagemErro(
        `O usuário "${jOriginal.username}" é Superadmin permanente. O acesso de administrador não pode ser alterado.`
      );
      return;
    }

    const estadoAtual = obterEstadoDraft(jOriginal);

    // Regra: Apenas mensalistas podem ser admin
    if (!estadoAtual.is_mensalista) {
      setMensagemErro(
        `Apenas jogadores mensalistas podem ser administradores. Torne "${jOriginal.nome}" mensalista primeiro.`
      );
      return;
    }

    const novoAdmin = !estadoAtual.is_admin;
    const novoMensalista = estadoAtual.is_mensalista;

    setMensagemErro(null);
    setMensagemSucesso(null);

    // Se o novo estado voltar a ser idêntico ao original, remove do rascunho
    if (
      novoMensalista === jOriginal.is_mensalista &&
      novoAdmin === jOriginal.is_admin
    ) {
      setRascunhos((prev) => {
        const cop = { ...prev };
        delete cop[jOriginal.id];
        return cop;
      });
    } else {
      setRascunhos((prev) => ({
        ...prev,
        [jOriginal.id]: {
          is_mensalista: novoMensalista,
          is_admin: novoAdmin,
        },
      }));
    }
  }


  function descartarAlteracoes() {
    setRascunhos({});
    setMensagemErro(null);
    setMensagemSucesso("Alterações descartadas.");
  }

  async function confirmarResetSenha() {
    if (!alvoReset || resetandoId !== null) return;

    setResetandoId(alvoReset.id);
    try {
      await resetarSenhaJogador(alvoReset.id);
      setSnackbar({
        visivel: true,
        tipo: "sucesso",
        mensagem: `Senha de ${alvoReset.nome} resetada para "123".`,
      });
      setAlvoReset(null);
    } catch (err) {
      setSnackbar({
        visivel: true,
        tipo: "erro",
        mensagem: err instanceof Error ? err.message : "Erro ao resetar senha.",
      });
    } finally {
      setResetandoId(null);
    }
  }

  async function salvarTodasAlteracoes() {
    if (!temAlteracoes) return;

    setSalvandoLote(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      // Salva cada jogador modificado no Supabase
      const idsModificados = Object.keys(rascunhos).map(Number);

      for (const id of idsModificados) {
        const jOriginal = jogadores.find((j) => j.id === id);
        const draft = rascunhos[id];

        if (jOriginal && draft) {
          await atualizarCaracteristicasJogador(id, jOriginal.username, {
            is_mensalista: draft.is_mensalista,
            is_admin: draft.is_admin,
          });
        }
      }

      // Atualiza a lista original local com os rascunhos confirmados
      setJogadores(jogadoresDraft);
      setRascunhos({});

      setMensagemSucesso(
        `Sucesso! ${idsModificados.length} alteração(ões) salva(s) com sucesso.`
      );
    } catch (err) {
      setMensagemErro(
        err instanceof Error
          ? err.message
          : "Erro ao salvar alterações no servidor."
      );
    } finally {
      setSalvandoLote(false);
    }
  }

  // Filtragem da lista com estado de rascunho
  const jogadoresFiltrados = jogadoresDraft.filter((j) => {
    const matchBusca =
      j.nome.toLowerCase().includes(busca.toLowerCase()) ||
      j.username.toLowerCase().includes(busca.toLowerCase());

    if (!matchBusca) return false;

    if (filtro === "mensalistas") return j.is_mensalista;
    if (filtro === "avulsos") return !j.is_mensalista;
    if (filtro === "admins") return j.is_admin || isSuperAdmin(j.username);

    return true;
  });

  if (carregando) return <SkeletonGestao />;

  return (
    <div className="px-3 py-4 pb-32 sm:px-4 max-w-3xl mx-auto space-y-5 relative">
      <button
        onClick={() => voltar(navigate, '/administrador')}
        className="inline-flex items-center gap-1 text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Users className="w-6 h-6 text-primaria" />
          Gestão de Jogadores
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Marque os mensalistas (máximo {MAX_MENSALISTAS}) e administradores. As alterações são aplicadas ao clicar em <strong>Confirmar Alterações</strong>.
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
            <span className="font-semibold block">
              Limite Máximo Atingido ({MAX_MENSALISTAS}/{MAX_MENSALISTAS} Mensalistas)
            </span>
            <span className="opacity-90">
              O limite de {MAX_MENSALISTAS} mensalistas foi alcançado. Para definir um novo mensalista, desmarque um mensalista atual.
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
                  width: `${Math.min(
                    100,
                    (totalMensalistas / MAX_MENSALISTAS) * 100
                  )}%`,
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
      {jogadoresFiltrados.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum jogador encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jogadoresFiltrados.map((j) => {
            const jOriginal = jogadores.find((orig) => orig.id === j.id)!;
            const superadmin = isSuperAdmin(j.username);
            const modificado = Boolean(rascunhos[j.id]);
            const bloqMensalista = !j.is_mensalista && limiteAtingido;

            return (
              <div
                key={j.id}
                className={`rounded-xl border bg-white dark:bg-neutral-900/80 p-3.5 shadow-xs space-y-3 transition ${
                  modificado
                    ? "border-green-500 dark:border-green-500/80 ring-2 ring-green-500/20 dark:ring-green-500/30"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
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

                        {modificado && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300 animate-pulse shrink-0">
                            <Sparkles className="w-3 h-3 text-green-600 dark:text-green-400" />
                            Pendente
                          </span>
                        )}

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
                    disabled={salvandoLote}
                    onClick={() => alternarMensalistaDraft(jOriginal)}
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
                    disabled={salvandoLote || superadmin}
                    onClick={() => alternarAdminDraft(jOriginal)}
                    title={
                      superadmin
                        ? "Superadmin permanente (acesso não pode ser removido)"
                        : !j.is_mensalista
                        ? "Apenas jogadores mensalistas podem ser administradores"
                        : undefined
                    }
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                      superadmin
                        ? "border-amber-300/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 opacity-90 cursor-not-allowed"
                        : j.is_admin
                        ? "border-blue-300 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 hover:bg-blue-100/60 dark:hover:bg-blue-950/40"
                        : !j.is_mensalista
                        ? "border-neutral-200/80 bg-neutral-100/60 dark:border-neutral-800/50 dark:bg-neutral-900/40 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/90 dark:hover:bg-neutral-800/40"
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
                            : !j.is_mensalista
                            ? "border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
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
                      ) : !j.is_mensalista ? (
                        "Requer Mensalista"
                      ) : (
                        "Tornar Admin"
                      )}
                    </span>
                  </button>

                  {/* Ações: Resetar Senha */}
                  {!superadmin && (
                    <button
                      type="button"
                      disabled={resetandoId !== null}
                      onClick={() => setAlvoReset(jOriginal)}
                      title="Redefinir a senha para o padrão 123"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                        <span className="font-semibold">Resetar Senha</span>
                      </div>

                      <span className="text-[11px] font-medium opacity-80">
                        {resetandoId === j.id ? "Resetando..." : "Padrão \"123\""}
                      </span>
                    </button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar / Action Confirmation Footer */}
      {temAlteracoes && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-50 animate-slide-up">
          <div className="bg-neutral-900/95 dark:bg-neutral-900/95 text-white backdrop-blur-md border border-neutral-800 shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-6 rounded-full bg-green-500 text-neutral-950 font-bold text-xs flex items-center justify-center shrink-0">
                {qtdModificacoes}
              </span>
              <span className="text-xs font-semibold text-neutral-200 truncate">
                {qtdModificacoes === 1
                  ? "1 alteração pendente"
                  : `${qtdModificacoes} alterações pendentes`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={salvandoLote}
                onClick={descartarAlteracoes}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>

              <button
                type="button"
                disabled={salvandoLote}
                onClick={salvarTodasAlteracoes}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition shadow-md disabled:opacity-50 shrink-0"
              >
                {salvandoLote ? (
                  "Salvando..."
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Confirmar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de Reset de Senha */}
      <ConfirmDialog
        open={alvoReset !== null}
        onClose={() => setAlvoReset(null)}
        onConfirm={confirmarResetSenha}
        titulo="Resetar senha"
        mensagem={
          alvoReset
            ? `Redefinir a senha de ${alvoReset.nome} (@${alvoReset.username}) para o padrão "123"? Ele deve trocá-la depois no Perfil.`
            : undefined
        }
        textoConfirmar={resetandoId !== null ? "Resetando..." : "Resetar"}
      />

      <Snackbar
        mensagem={snackbar.mensagem}
        tipo={snackbar.tipo}
        visivel={snackbar.visivel}
        onFechar={() => setSnackbar((s) => ({ ...s, visivel: false }))}
      />

    </div>
  );
}
