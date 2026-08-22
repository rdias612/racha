import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { useEscalacaoTimes } from "../hooks/useEscalacaoTimes";
import { formatarDataCompleta } from "../lib/formatacao";
import { EscalacaoTimesEditor } from "../components/EscalacaoTimesEditor";
import { voltar } from "../lib/navegacao";

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

  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  const {
    times,
    feedback,
    setFeedback,
    atribuirTime,
    autoEscalar,
  } = useEscalacaoTimes({
    jogadores: jogadoresConfirmados,
    mediasNotas,
  });

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

  function handleAutoEscalar() {
    setErro(null);
    autoEscalar();
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
      onVoltar={() => voltar(navigate, '/partida/nova')}
      jogadores={jogadoresConfirmados}
      times={times}
      mediasNotas={mediasNotas}
      onAtribuirTime={atribuirTime}
      onAutoEscalar={handleAutoEscalar}
      onSalvar={salvarComoDraft}
      salvando={salvando}
      erro={erro}
      feedback={feedback}
    />
  );
}
