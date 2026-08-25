import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import {
  listarTodosJogadores,
  atualizarCaracteristicasJogador,
  resetarSenhaJogador,
  isSuperAdmin,
  MAX_MENSALISTAS,
  type JogadorLista,
} from '../lib/jogadores';
import { POSICOES } from '../lib/times';
import { Avatar } from '../components/Avatar';
import { MensagemEstado } from '../components/Estado';
import { SkeletonGestao } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar, type TipoSnackbar } from '../components/Snackbar';
import { voltar } from '../lib/navegacao';
import {
  ArrowLeft,
  Users,
  Shield,
  Search,
  Check,
  Crown,
  UserCheck,
  UserCheck2,
  Save,
  RotateCcw,
  Sparkles,
  KeyRound,
} from 'lucide-react';

type FiltroTipo = 'todos' | 'mensalistas' | 'avulsos' | 'admins';

interface AlteracaoRascunho {
  is_mensalista: boolean;
  is_admin: boolean;
}

export function GestaoJogadores() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');

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
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const lista = await listarTodosJogadores();
        if (ativo) setJogadores(lista);
      } catch (err) {
        if (ativo) {
          setMensagemErro(err instanceof Error ? err.message : 'Erro ao carregar jogadores.');
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
  const totalAvulsos = jogadoresDraft.filter(
    (j) => !j.is_mensalista && j.posicao !== 'goleiro'
  ).length;
  const totalAdmins = jogadoresDraft.filter((j) => j.is_admin || isSuperAdmin(j.username)).length;
  const totalSuperAdmins = jogadoresDraft.filter((j) => isSuperAdmin(j.username)).length;

  const qtdModificacoes = Object.keys(rascunhos).length;
  const temAlteracoes = qtdModificacoes > 0;
  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  function alternarMensalistaDraft(jOriginal: JogadorLista) {
    if (jOriginal.posicao === 'goleiro') {
      setMensagemErro('Goleiros não pagam para jogar e são isentos de mensalidade.');
      return;
    }

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
    if (novoMensalista === jOriginal.is_mensalista && novoAdmin === jOriginal.is_admin) {
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
    if (novoMensalista === jOriginal.is_mensalista && novoAdmin === jOriginal.is_admin) {
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
    setMensagemSucesso('Alterações descartadas.');
  }

  async function confirmarResetSenha() {
    if (!alvoReset || resetandoId !== null) return;

    setResetandoId(alvoReset.id);
    try {
      await resetarSenhaJogador(alvoReset.id);
      setSnackbar({
        visivel: true,
        tipo: 'sucesso',
        mensagem: `Senha de ${alvoReset.nome} resetada para "123".`,
      });
      setAlvoReset(null);
    } catch (err) {
      setSnackbar({
        visivel: true,
        tipo: 'erro',
        mensagem: err instanceof Error ? err.message : 'Erro ao resetar senha.',
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

      setMensagemSucesso(`Sucesso! ${idsModificados.length} alteração(ões) salva(s) com sucesso.`);
    } catch (err) {
      setMensagemErro(
        err instanceof Error ? err.message : 'Erro ao salvar alterações no servidor.'
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

    if (filtro === 'mensalistas') return j.is_mensalista;
    if (filtro === 'avulsos') return !j.is_mensalista && j.posicao !== 'goleiro';
    if (filtro === 'admins') return j.is_admin || isSuperAdmin(j.username);

    return true;
  });

  if (carregando) return <SkeletonGestao />;

  return (
    <div className="px-3 py-4 pb-36 sm:px-4 max-w-3xl mx-auto space-y-4 text-giz relative">
      <button
        onClick={() => voltar(navigate, '/administrador')}
        className="inline-flex items-center gap-1 text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        <ArrowLeft className="size-3.5" />← voltar
      </button>

      <div className="sumula-header pb-2 flex items-baseline justify-between">
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz flex items-center gap-2">
            <Users className="size-5 text-destaque" />
            Gestão de Atletas
          </h2>
          <p className="text-xs font-mono text-giz-fraco mt-0.5">
            Mensalistas (máx {MAX_MENSALISTAS}) e administradores do racha
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Oficial CBO
        </span>
      </div>

      {mensagemErro && <MensagemEstado>{mensagemErro}</MensagemEstado>}
      {mensagemSucesso && <MensagemEstado tipo="sucesso">{mensagemSucesso}</MensagemEstado>}

      {limiteAtingido && (
        <div className="rounded-[4px] border border-destaque/50 bg-destaque/10 p-3 text-xs text-giz flex items-start gap-2.5 shadow-carimbo">
          <UserCheck2 className="size-4 text-destaque shrink-0 mt-0.5" />
          <div>
            <span className="font-display font-bold uppercase tracking-wider text-destaque block">
              Limite Máximo Atingido ({MAX_MENSALISTAS}/{MAX_MENSALISTAS} Mensalistas)
            </span>
            <span className="text-giz-fraco text-xs font-mono">
              O limite de {MAX_MENSALISTAS} mensalistas foi alcançado. Para definir um novo
              mensalista, desmarque um mensalista atual.
            </span>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Total Geral
            </span>
            <Users className="size-4 text-destaque" />
          </div>
          <div className="text-2xl font-mono font-black text-giz tabular-nums">
            {totalJogadores}
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-giz-fraco mb-1">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                Mensalistas
              </span>
              <UserCheck className="size-4 text-ok" />
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-ok tabular-nums">{totalMensalistas}</span>
              <span className="text-xs font-bold text-giz-fraco">/ {MAX_MENSALISTAS}</span>
            </div>
          </div>

          <div className="mt-2">
            <div className="h-1.5 w-full bg-superficie-2 border border-borda rounded-[2px] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  limiteAtingido ? 'bg-destaque' : 'bg-ok'
                }`}
                style={{
                  width: `${Math.min(100, (totalMensalistas / MAX_MENSALISTAS) * 100)}%`,
                }}
              />
            </div>
            <div className="text-[9px] font-mono text-giz-fraco mt-1">
              {limiteAtingido
                ? 'Limite lotado'
                : `${MAX_MENSALISTAS - totalMensalistas} vaga(s) livre(s)`}
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Admins
            </span>
            <Shield className="size-4 text-destaque" />
          </div>
          <div className="text-2xl font-mono font-black text-destaque tabular-nums">
            {totalAdmins}
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Superadmins
            </span>
            <Crown className="size-4 text-destaque" />
          </div>
          <div className="text-2xl font-mono font-black text-destaque tabular-nums">
            {totalSuperAdmins}
          </div>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-giz-fraco" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou @usuário..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-[4px] border border-borda bg-superficie text-giz placeholder-giz-fraco shadow-carimbo focus:outline-none focus:border-destaque font-mono"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-xs text-giz-fraco hover:text-giz"
            >
              ✕
            </button>
          )}
        </div>

        {/* Abas de filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setFiltro('todos')}
            className={`min-h-[36px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 ${
              filtro === 'todos'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Todos ({totalJogadores})
          </button>
          <button
            onClick={() => setFiltro('mensalistas')}
            className={`min-h-[36px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 ${
              filtro === 'mensalistas'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})
          </button>
          <button
            onClick={() => setFiltro('avulsos')}
            className={`min-h-[36px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 ${
              filtro === 'avulsos'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Avulsos ({totalAvulsos})
          </button>
          <button
            onClick={() => setFiltro('admins')}
            className={`min-h-[36px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 ${
              filtro === 'admins'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Admins ({totalAdmins})
          </button>
        </div>
      </div>

      {/* Lista de Jogadores */}
      {jogadoresFiltrados.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-borda bg-superficie rounded-[4px]">
          <p className="text-xs font-mono text-giz-fraco">
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
                className={`rounded-[4px] border bg-superficie p-3.5 shadow-carimbo space-y-3 transition ${
                  modificado ? 'border-destaque ring-2 ring-destaque/30' : 'border-borda'
                }`}
              >
                {/* Linha Superior: Dados do Jogador */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar nome={j.nome} posicao={j.posicao} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display font-bold text-sm uppercase tracking-wide text-giz truncate">
                          {j.nome}
                        </span>

                        {modificado && (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-destaque/20 border border-destaque/50 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-destaque animate-pulse shrink-0">
                            <Sparkles className="size-3 text-destaque" />
                            Pendente
                          </span>
                        )}

                        {superadmin && (
                          <span
                            title="Superadmin permanente"
                            className="inline-flex items-center gap-1 rounded-[2px] bg-destaque text-destaque-tinta px-1.5 py-0.5 text-[9px] font-display font-black uppercase tracking-wider shadow-xs shrink-0"
                          >
                            <Crown className="size-3" />
                            Superadmin
                          </span>
                        )}
                        {!superadmin && j.is_admin && (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-superficie-2 border border-destaque/50 text-destaque px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider shrink-0">
                            <Shield className="size-3" />
                            Admin
                          </span>
                        )}
                        {j.posicao === 'goleiro' ? (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/15 border border-ok/40 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-ok shrink-0">
                            🧤 Isento (Goleiro)
                          </span>
                        ) : j.is_mensalista ? (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/15 border border-ok/40 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-ok shrink-0">
                            <UserCheck2 className="size-3 text-ok" />
                            Mensalista
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-superficie-2 border border-borda px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-giz-fraco shrink-0">
                            Avulso
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-giz-fraco truncate mt-0.5">
                        @{j.username} · {POSICOES[j.posicao]}
                        {j.posicao_b && ` / 2ª ${POSICOES[j.posicao_b]}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha Inferior: Controles de Gestão */}
                <div className="pt-2.5 border-t border-borda grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Toggle Mensalista */}
                  <button
                    type="button"
                    disabled={salvandoLote || j.posicao === 'goleiro'}
                    onClick={() => alternarMensalistaDraft(jOriginal)}
                    title={
                      j.posicao === 'goleiro'
                        ? 'Goleiros não pagam para jogar (isentos de mensalidade)'
                        : bloqMensalista
                          ? `Limite de ${MAX_MENSALISTAS} mensalistas atingido`
                          : undefined
                    }
                    className={`flex items-center justify-between p-2.5 rounded-[3px] border transition min-h-[44px] ${
                      j.posicao === 'goleiro'
                        ? 'border-borda bg-superficie-2 text-giz-fraco/50 cursor-not-allowed'
                        : j.is_mensalista
                          ? 'border-ok/60 bg-ok/10 text-ok hover:bg-ok/20'
                          : bloqMensalista
                            ? 'border-borda bg-superficie-2 text-giz-fraco opacity-60'
                            : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-4 rounded-[2px] flex items-center justify-center border transition ${
                          j.is_mensalista
                            ? 'bg-ok border-ok text-white'
                            : 'border-borda bg-superficie'
                        }`}
                      >
                        {j.is_mensalista && <Check className="size-3 stroke-[3]" />}
                      </div>
                      <span className="font-display font-bold uppercase tracking-wider">
                        Mensalista
                      </span>
                    </div>

                    <span className="text-[10px] font-mono opacity-80">
                      {j.posicao === 'goleiro'
                        ? 'Isento (Goleiro)'
                        : j.is_mensalista
                          ? 'Ativo'
                          : bloqMensalista
                            ? `Lotado (${MAX_MENSALISTAS})`
                            : 'Tornar Mensalista'}
                    </span>
                  </button>

                  {/* Toggle Admin */}
                  <button
                    type="button"
                    disabled={salvandoLote || superadmin}
                    onClick={() => alternarAdminDraft(jOriginal)}
                    title={
                      superadmin
                        ? 'Superadmin permanente (acesso não pode ser removido)'
                        : !j.is_mensalista
                          ? 'Apenas jogadores mensalistas podem ser administradores'
                          : undefined
                    }
                    className={`flex items-center justify-between p-2.5 rounded-[3px] border transition min-h-[44px] ${
                      superadmin
                        ? 'border-destaque/60 bg-destaque/15 text-destaque cursor-not-allowed'
                        : j.is_admin
                          ? 'border-destaque/60 bg-destaque/10 text-destaque hover:bg-destaque/20'
                          : !j.is_mensalista
                            ? 'border-borda bg-superficie-2 text-giz-fraco/50'
                            : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-4 rounded-[2px] flex items-center justify-center border transition ${
                          superadmin
                            ? 'bg-destaque border-destaque text-destaque-tinta'
                            : j.is_admin
                              ? 'bg-destaque border-destaque text-destaque-tinta'
                              : 'border-borda bg-superficie'
                        }`}
                      >
                        {(superadmin || j.is_admin) && <Check className="size-3 stroke-[3]" />}
                      </div>
                      <span className="font-display font-bold uppercase tracking-wider">
                        Administrador
                      </span>
                    </div>

                    <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
                      {superadmin ? (
                        <>
                          <Crown className="size-3 text-destaque" />
                          <span>Superadmin</span>
                        </>
                      ) : j.is_admin ? (
                        'Ativo'
                      ) : !j.is_mensalista ? (
                        'Requer Mensalista'
                      ) : (
                        'Tornar Admin'
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
                      className="flex items-center justify-between p-2.5 rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-borda transition disabled:opacity-50 min-h-[44px] sm:col-span-2"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="size-4 text-giz-fraco" />
                        <span className="font-display font-bold uppercase tracking-wider">
                          Resetar Senha
                        </span>
                      </div>

                      <span className="text-[10px] font-mono opacity-80">
                        {resetandoId === j.id ? 'Resetando...' : 'Padrão "123"'}
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
          <div className="bg-superficie text-giz backdrop-blur-md border-2 border-destaque shadow-carimbo-preto rounded-[4px] p-3 flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-6 rounded-[2px] bg-destaque text-destaque-tinta font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {qtdModificacoes}
              </span>
              <span className="text-xs font-display font-bold uppercase tracking-wider text-giz truncate">
                {qtdModificacoes === 1
                  ? '1 alteração pendente'
                  : `${qtdModificacoes} alterações pendentes`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={salvandoLote}
                onClick={descartarAlteracoes}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-[3px] border border-borda text-xs font-display font-bold uppercase tracking-wider text-giz-fraco hover:text-giz hover:bg-superficie-2 transition disabled:opacity-50 min-h-[44px]"
              >
                <RotateCcw className="size-3.5" />
                <span>Descartar</span>
              </button>

              <button
                type="button"
                disabled={salvandoLote}
                onClick={salvarTodasAlteracoes}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider bg-destaque hover:brightness-105 text-destaque-tinta transition shadow-carimbo active:translate-y-px disabled:opacity-50 shrink-0 min-h-[44px]"
              >
                {salvandoLote ? (
                  'Salvando...'
                ) : (
                  <>
                    <Save className="size-3.5" />
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
        textoConfirmar={resetandoId !== null ? 'Resetando...' : 'Resetar'}
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
