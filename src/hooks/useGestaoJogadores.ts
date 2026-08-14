import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listarTodosJogadores,
  atualizarCaracteristicasJogador,
  isSuperAdmin,
  MAX_MENSALISTAS,
  type JogadorLista,
} from "../lib/jogadores";
import { extrairMensagemErro } from "../lib/formatacao";

export type FiltroTipo = "todos" | "mensalistas" | "avulsos" | "admins";

export interface AlteracaoRascunho {
  is_mensalista: boolean;
  is_admin: boolean;
}

export function useGestaoJogadores() {
  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");
  const [rascunhos, setRascunhos] = useState<Record<number, AlteracaoRascunho>>({});
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const carregarJogadores = useCallback(async () => {
    try {
      setCarregando(true);
      const lista = await listarTodosJogadores();
      setJogadores(lista);
    } catch (err) {
      setMensagemErro(extrairMensagemErro(err, "Erro ao carregar jogadores."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarJogadores();
  }, [carregarJogadores]);

  // Função para obter o estado de um jogador (original mesclado com rascunho)
  const obterEstadoDraft = useCallback(
    (j: JogadorLista): JogadorLista => {
      const draft = rascunhos[j.id];
      if (!draft) return j;
      return {
        ...j,
        is_mensalista: draft.is_mensalista,
        is_admin: isSuperAdmin(j.username) ? true : draft.is_admin,
      };
    },
    [rascunhos]
  );

  // Lista de jogadores com rascunhos aplicados
  const jogadoresDraft = useMemo(
    () => jogadores.map(obterEstadoDraft),
    [jogadores, obterEstadoDraft]
  );

  // Métricas calculadas
  const totalJogadores = jogadores.length;
  const totalMensalistas = useMemo(
    () => jogadoresDraft.filter((j) => j.is_mensalista).length,
    [jogadoresDraft]
  );
  const totalAdmins = useMemo(
    () => jogadoresDraft.filter((j) => j.is_admin || isSuperAdmin(j.username)).length,
    [jogadoresDraft]
  );
  const totalSuperAdmins = useMemo(
    () => jogadoresDraft.filter((j) => isSuperAdmin(j.username)).length,
    [jogadoresDraft]
  );

  const qtdModificacoes = Object.keys(rascunhos).length;
  const temAlteracoes = qtdModificacoes > 0;
  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  const alternarMensalistaDraft = useCallback(
    (jOriginal: JogadorLista) => {
      const estadoAtual = obterEstadoDraft(jOriginal);
      const novoMensalista = !estadoAtual.is_mensalista;

      // Se estiver tentando virar mensalista e já atingiu o limite
      if (novoMensalista && totalMensalistas >= MAX_MENSALISTAS) {
        setMensagemErro(
          `Limite máximo de ${MAX_MENSALISTAS} mensalistas atingido (${totalMensalistas}/${MAX_MENSALISTAS}). Remova o status de outro jogador antes de adicionar.`
        );
        return;
      }

      setMensagemErro(null);
      setMensagemSucesso(null);

      let novoAdmin = estadoAtual.is_admin;

      // Regra: Se deixar de ser mensalista, deixa obrigatoriamente de ser admin (exceto superadmin)
      if (!novoMensalista && estadoAtual.is_admin && !isSuperAdmin(jOriginal.username)) {
        novoAdmin = false;
        setMensagemSucesso(
          `O status de administrador de "${jOriginal.nome}" foi desativado (apenas mensalistas podem ser admins).`
        );
      }

      // Se o novo estado voltar ao original, remove do rascunho
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
    },
    [obterEstadoDraft, totalMensalistas]
  );

  const alternarAdminDraft = useCallback(
    (jOriginal: JogadorLista) => {
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
    },
    [obterEstadoDraft]
  );

  const descartarAlteracoes = useCallback(() => {
    setRascunhos({});
    setMensagemErro(null);
    setMensagemSucesso("Alterações descartadas.");
  }, []);

  const salvarTodasAlteracoes = useCallback(async () => {
    if (Object.keys(rascunhos).length === 0) return;

    setSalvandoLote(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
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

      setJogadores(jogadoresDraft);
      setRascunhos({});
      setMensagemSucesso(
        `Sucesso! ${idsModificados.length} alteração(ões) salva(s) com sucesso.`
      );
    } catch (err) {
      setMensagemErro(
        extrairMensagemErro(err, "Erro ao salvar alterações no servidor.")
      );
    } finally {
      setSalvandoLote(false);
    }
  }, [jogadores, jogadoresDraft, rascunhos]);

  // Lista filtrada para renderização
  const jogadoresFiltrados = useMemo(() => {
    const termoBusca = busca.trim().toLowerCase();

    return jogadoresDraft.filter((j) => {
      const matchBusca =
        !termoBusca ||
        j.nome.toLowerCase().includes(termoBusca) ||
        j.username.toLowerCase().includes(termoBusca);

      if (!matchBusca) return false;

      if (filtro === "mensalistas") return j.is_mensalista;
      if (filtro === "avulsos") return !j.is_mensalista;
      if (filtro === "admins") return j.is_admin || isSuperAdmin(j.username);

      return true;
    });
  }, [busca, filtro, jogadoresDraft]);

  return {
    jogadores,
    jogadoresDraft,
    jogadoresFiltrados,
    carregando,
    busca,
    setBusca,
    filtro,
    setFiltro,
    rascunhos,
    salvandoLote,
    mensagemSucesso,
    mensagemErro,
    totalJogadores,
    totalMensalistas,
    totalAdmins,
    totalSuperAdmins,
    qtdModificacoes,
    temAlteracoes,
    limiteAtingido,
    obterEstadoDraft,
    alternarMensalistaDraft,
    alternarAdminDraft,
    descartarAlteracoes,
    salvarTodasAlteracoes,
    carregarJogadores,
  };
}
