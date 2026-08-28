import { useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import {
  listarTodosJogadores,
  salvarCaracteristicasJogadores,
  resetarSenhaJogador,
  isSuperAdminId,
  isentoMensalidade,
  podeSerAdmin,
  MAX_MENSALISTAS,
  type JogadorLista,
} from '../lib/jogadores';
import { MensagemEstado } from '../components/Estado';
import { SkeletonGestao } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CampoBusca } from '../components/CampoBusca';
import { BarraRascunhoGestao } from '../components/BarraRascunhoGestao';
import { LinhaJogadorGestao } from '../components/LinhaJogadorGestao';
import { ResumoGestao } from '../components/ResumoGestao';
import { formatarMensagemErro } from '../lib/erros';
import { Users } from 'lucide-react';

type FiltroTipo = 'todos' | 'mensalistas' | 'avulsos' | 'admins';

interface AlteracaoRascunho {
  is_mensalista: boolean;
  is_admin: boolean;
}

export function GestaoJogadores() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();

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
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const lista = await listarTodosJogadores();
        if (ativo) setJogadores(lista);
      } catch (err) {
        if (ativo) {
          setMensagemErro(formatarMensagemErro(err, 'Erro ao carregar jogadores.'));
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

  // Função para obter o estado de um jogador (original mesclado com rascunho)
  const obterEstadoDraft = useCallback(
    (j: JogadorLista): JogadorLista => {
      const draft = rascunhos[j.id];
      if (!draft) return j;
      return {
        ...j,
        is_mensalista: draft.is_mensalista,
        is_admin: isSuperAdminId(j.id) ? true : draft.is_admin,
      };
    },
    [rascunhos]
  );

  // Estatísticas calculadas sobre o estado de Rascunho (em tempo real)
  const jogadoresDraft = useMemo(
    () => jogadores.map(obterEstadoDraft),
    [jogadores, obterEstadoDraft]
  );

  const totalJogadores = jogadores.length;
  const { totalMensalistas, totalAvulsos, totalAdmins, totalSuperAdmins } = useMemo(() => {
    let mensalistas = 0;
    let avulsos = 0;
    let admins = 0;
    let superAdmins = 0;

    for (const j of jogadoresDraft) {
      if (j.is_mensalista) mensalistas++;
      if (!j.is_mensalista && j.posicao !== 'goleiro') avulsos++;
      if (j.is_admin || isSuperAdminId(j.id)) admins++;
      if (isSuperAdminId(j.id)) superAdmins++;
    }

    return {
      totalMensalistas: mensalistas,
      totalAvulsos: avulsos,
      totalAdmins: admins,
      totalSuperAdmins: superAdmins,
    };
  }, [jogadoresDraft]);

  const qtdModificacoes = Object.keys(rascunhos).length;
  const temAlteracoes = qtdModificacoes > 0;
  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  // Filtragem da lista com estado de rascunho
  const jogadoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return jogadoresDraft.filter((j) => {
      const matchBusca = !termo || j.username.toLowerCase().includes(termo);
      if (!matchBusca) return false;

      if (filtro === 'mensalistas') return j.is_mensalista;
      if (filtro === 'avulsos') return !j.is_mensalista && j.posicao !== 'goleiro';
      if (filtro === 'admins') return j.is_admin || isSuperAdminId(j.id);

      return true;
    });
  }, [jogadoresDraft, busca, filtro]);

  if (!isAdmin) return <Navigate to="/" replace />;

  function alternarMensalistaDraft(jOriginal: JogadorLista) {
    if (isentoMensalidade(jOriginal)) {
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
    if (!novoMensalista && estadoAtual.is_admin && !isSuperAdminId(jOriginal.id)) {
      novoAdmin = false;
      setMensagemSucesso(
        `O status de administrador de "@${jOriginal.username}" foi desativado (apenas mensalistas podem ser admins).`
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
    if (isSuperAdminId(jOriginal.id)) {
      setMensagemErro(
        `O usuário "${jOriginal.username}" é Superadmin permanente. O acesso de administrador não pode ser alterado.`
      );
      return;
    }

    const estadoAtual = obterEstadoDraft(jOriginal);

    // Regra: Apenas mensalistas podem ser admin
    if (!podeSerAdmin(estadoAtual)) {
      setMensagemErro(
        `Apenas jogadores mensalistas podem ser administradores. Torne "@${jOriginal.username}" mensalista primeiro.`
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
      mostrarSnackbar('sucesso', `Senha de @${alvoReset.username} resetada para "123".`);
      setAlvoReset(null);
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Erro ao resetar senha.'));
    } finally {
      setResetandoId(null);
    }
  }

  async function salvarTodasAlteracoes() {
    if (!temAlteracoes || !adminLogado) return;

    setSalvandoLote(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      // Lote transacional numa única RPC: o servidor aplica tudo ou nada
      // (AGENTS 7.4) — uma falha no meio não deixa metade dos jogadores alterada.
      const lote = Object.entries(rascunhos).map(([idStr, draft]) => ({
        id: Number(idStr),
        is_mensalista: draft.is_mensalista,
        is_admin: draft.is_admin,
      }));

      await salvarCaracteristicasJogadores(adminLogado.id, lote);

      // Estado local só é commitado após o servidor confirmar o lote inteiro.
      setJogadores(jogadoresDraft);
      setRascunhos({});

      setMensagemSucesso(`Sucesso! ${lote.length} alteração(ões) salva(s) com sucesso.`);
    } catch (err) {
      setMensagemErro(formatarMensagemErro(err, 'Erro ao salvar alterações no servidor.'));
    } finally {
      setSalvandoLote(false);
    }
  }

  if (carregando) return <SkeletonGestao />;

  return (
    <div className="px-3 py-4 pb-36 sm:px-4 max-w-3xl mx-auto space-y-4 text-giz relative">
      <BotaoVoltar fallback="/administrador" />

      <div className="sumula-header pb-2 flex items-baseline justify-between">
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz flex items-center gap-2">
            <Users className="size-5 text-destaque-texto" />
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

      <ResumoGestao
        totalJogadores={totalJogadores}
        totalMensalistas={totalMensalistas}
        totalAdmins={totalAdmins}
        totalSuperAdmins={totalSuperAdmins}
      />

      {/* Busca e Filtros */}
      <div className="space-y-2.5">
        <CampoBusca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar por @usuário..."
          variante="superficie"
          fonte="mono"
        />

        {/* Abas de filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setFiltro('todos')}
            className={`min-h-[44px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 cursor-pointer ${
              filtro === 'todos'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Todos ({totalJogadores})
          </button>
          <button
            onClick={() => setFiltro('mensalistas')}
            className={`min-h-[44px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 cursor-pointer ${
              filtro === 'mensalistas'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})
          </button>
          <button
            onClick={() => setFiltro('avulsos')}
            className={`min-h-[44px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 cursor-pointer ${
              filtro === 'avulsos'
                ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                : 'bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`}
          >
            Avulsos ({totalAvulsos})
          </button>
          <button
            onClick={() => setFiltro('admins')}
            className={`min-h-[44px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 cursor-pointer ${
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
            const jOriginal = jogadores.find((orig) => orig.id === j.id) ?? j;
            return (
              <LinhaJogadorGestao
                key={j.id}
                jogador={j}
                jogadorOriginal={jOriginal}
                modificado={Boolean(rascunhos[j.id])}
                limiteAtingido={limiteAtingido}
                salvandoLote={salvandoLote}
                resetandoId={resetandoId}
                onAlternarMensalista={alternarMensalistaDraft}
                onAlternarAdmin={alternarAdminDraft}
                onSolicitarResetSenha={setAlvoReset}
              />
            );
          })}
        </div>
      )}

      {/* Floating Action Bar / Action Confirmation Footer */}
      {temAlteracoes && (
        <BarraRascunhoGestao
          qtdModificacoes={qtdModificacoes}
          salvandoLote={salvandoLote}
          onDescartar={descartarAlteracoes}
          onSalvar={salvarTodasAlteracoes}
        />
      )}

      {/* Confirmação de Reset de Senha */}
      <ConfirmDialog
        open={alvoReset !== null}
        onClose={() => setAlvoReset(null)}
        onConfirm={confirmarResetSenha}
        titulo="Resetar senha"
        mensagem={
          alvoReset
            ? `Redefinir a senha de @${alvoReset.username} para o padrão "123"? Ele deve trocá-la depois no Perfil.`
            : undefined
        }
        textoConfirmar={resetandoId !== null ? 'Resetando...' : 'Resetar'}
      />

      <Snackbar {...snackbarProps} />
    </div>
  );
}
