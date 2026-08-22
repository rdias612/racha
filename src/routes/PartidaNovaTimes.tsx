import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { type TimeId } from "../lib/times";
import { formatarDataCompleta } from "../lib/formatacao";
import { gerarEscalacaoAutomatica } from "../lib/escalacao";
import {
  EscalacaoTimesEditor,
  LIMITE_POR_TIME,
} from "../components/EscalacaoTimesEditor";

interface EstadoPartida {
  selecionados: number[];
  jogadores: JogadorLista[];
  dataJogo: string;
  horaJogo?: string;
}

const STORAGE_KEY = "racha_nova_partida";

export function PartidaNovaTimes() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = location.state as EstadoPartida | null;

  const [times, setTimes] = useState<Record<number, TimeId>>({});
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    obterMediasNotasJogadores()
      .then(setMediasNotas)
      .catch(() => {
        // Falha silenciosa: assume nota 6.0 padrao se falhar busca
      });
  }, []);

  // Apenas os confirmados recebidos via state.
  const jogadoresConfirmados = useMemo(
    () =>
      estado &&
      Array.isArray(estado.jogadores) &&
      Array.isArray(estado.selecionados)
        ? estado.jogadores.filter((j) => estado.selecionados.includes(j.id))
        : [],
    [estado?.jogadores, estado?.selecionados],
  );

  // Guard admin.
  if (!isAdmin) return <Navigate to="/" replace />;

  // Guard de state ausente (acesso direto/refresh): volta para a Etapa 1.
  if (
    !estado ||
    !Array.isArray(estado.selecionados) ||
    !Array.isArray(estado.jogadores)
  ) {
    return <Navigate to="/partida/nova" replace />;
  }

  const horaJogo = estado.horaJogo || "19:00";
  const { dataJogo } = estado;

  function autoEscalar() {
    setErro(null);
    const proposta = gerarEscalacaoAutomatica(jogadoresConfirmados, mediasNotas);
    const novos: Record<number, TimeId> = {};
    for (const p of proposta) novos[p.jogador.id] = p.time;
    setTimes(novos);

    const timeAPart = proposta.filter((p) => p.time === "a");
    const timeBPart = proposta.filter((p) => p.time === "b");
    const avgA = timeAPart.length
      ? (timeAPart.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / timeAPart.length).toFixed(1)
      : "0.0";
    const avgB = timeBPart.length
      ? (timeBPart.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / timeBPart.length).toFixed(1)
      : "0.0";
    setFeedback(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
  }

  function atribuirTime(id: number, time: TimeId) {
    setFeedback(null);
    const jogador = jogadoresConfirmados.find((j) => j.id === id);
    if (!jogador) return;

    const ehGoleiro = jogador.posicao === "goleiro";
    const atual = times[id];

    // Já está nesse time -> remove (sem time)
    if (atual && atual === time) {
      setTimes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Regra: cada time pode ter no máximo 1 goleiro.
    const destinoTemGoleiro = Object.entries(times).some(
      ([jidStr, tm]) =>
        tm === time &&
        Number(jidStr) !== id &&
        jogadoresConfirmados.find((x) => x.id === Number(jidStr))?.posicao === "goleiro"
    );
    if (ehGoleiro && destinoTemGoleiro) {
      setFeedback(
        `Cada time só pode ter 1 goleiro. ${jogador.nome} não pode ir para o ${time === "a" ? "Preto" : "Branco"}.`
      );
      return;
    }

    // Bloqueia se o time alvo já está cheio.
    const destinoCheio =
      Object.values(times).filter((tm) => tm === time).length >= LIMITE_POR_TIME;
    if (destinoCheio) return;

    setTimes((prev) => ({ ...prev, [id]: time }));
  }

  async function salvarComoDraft() {
    if (!adminLogado) return;
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    const dataIso = new Date(`${dataJogo}T${horaJogo}`).toISOString();
    const payload = jogadoresConfirmados.map((j) => ({
      jogador_id: j.id,
      time: times[j.id] ?? "a",
      posicao: j.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
    }));

    const { data, error } = await supabase.rpc("criar_partida", {
      p_data_jogo: dataIso,
      p_criado_por: adminLogado.id,
      p_participantes: payload,
    });

    setSalvando(false);

    if (error) {
      setErro("Erro ao criar partida: " + error.message);
      return;
    }
    if (data === null) {
      setErro("Falha ao criar partida (rollback). Verifique os dados.");
      return;
    }

    // Limpa o rascunho persistido da Etapa 1.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage indisponível — ignora silenciosamente.
    }

    setFeedback(`Partida #${data} criada.`);
    setTimeout(() => navigate(`/partida/${data}`, { replace: true }), 800);
  }

  const dataHoraIso =
    dataJogo && horaJogo ? `${dataJogo}T${horaJogo}` : dataJogo;
  const dataHoraTexto = dataHoraIso
    ? formatarDataCompleta(dataHoraIso)
    : `${dataJogo} · ${horaJogo}`;

  return (
    <EscalacaoTimesEditor
      titulo="Escolher times"
      subtitulo={
        dataHoraTexto ? (
          <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 mt-3">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
              {dataHoraTexto}
            </p>
          </section>
        ) : null
      }
      rotuloListaJogadores="Jogadores"
      salvarRotulo="Criar partida"
      salvandoRotulo="Criando…"
      onVoltar={() => navigate(-1)}
      jogadores={jogadoresConfirmados}
      times={times}
      mediasNotas={mediasNotas}
      onAtribuirTime={atribuirTime}
      onAutoEscalar={autoEscalar}
      onSalvar={salvarComoDraft}
      salvando={salvando}
      erro={erro}
      feedback={feedback}
    />
  );
}
