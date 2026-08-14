import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { type JogadorLista } from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { type TimeId } from "../lib/times";
import { formatarDataCompleta } from "../lib/formatacao";
import { EscalacaoTimesEditor } from "../components/EscalacaoTimesEditor";

interface EstadoPartida {
  selecionados: number[];
  jogadores: JogadorLista[];
  dataJogo: string;
  horaJogo: string;
}

const STORAGE_KEY = "racha_nova_partida";

export function PartidaNovaTimes() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = location.state as EstadoPartida | null;

  const [times, setTimes] = useState<Record<number, TimeId>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const { dataJogo, horaJogo } = estado;

  // Apenas os 16 confirmados recebidos via state.
  const jogadoresConfirmados = estado.jogadores.filter((j) =>
    estado.selecionados.includes(j.id),
  );

  async function salvarComoDraft() {
    if (!adminLogado) return;
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    const dataIso = new Date(`${dataJogo}T${horaJogo}`).toISOString();
    const payload = jogadoresConfirmados.map((j) => ({
      jogador_id: j.id,
      time: times[j.id],
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

  // Data/hora para o resumo (mesmo padrão do PartidaConfirma).
  const dataHoraIso =
    dataJogo && horaJogo ? `${dataJogo}T${horaJogo}` : dataJogo;
  const dataHoraTexto = dataHoraIso
    ? formatarDataCompleta(dataHoraIso)
    : `${dataJogo} · ${horaJogo}`;

  return (
    <EscalacaoTimesEditor
      titulo="Escolher times"
      onVoltar={() => navigate(-1)}
      jogadores={jogadoresConfirmados}
      times={times}
      onTimesChange={setTimes}
      onSalvar={salvarComoDraft}
      salvando={salvando}
      salvarRotulo="Criar partida"
      salvandoRotulo="Criando…"
      podeSalvarExtra={!!dataJogo}
      erro={erro}
      onLimparErro={() => setErro(null)}
      feedbackExterno={feedback}
      infoExtra={
        dataHoraTexto ? (
          <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
              {dataHoraTexto}
            </p>
          </section>
        ) : null
      }
    />
  );
}
