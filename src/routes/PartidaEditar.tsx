import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  UserPlus,
  Trash2,
  ArrowLeftRight,
  Search,
  X,
} from "lucide-react";
import { useAdmin } from "../hooks/useAdmin";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
import { TIMES, POSICOES, type TimeId } from "../lib/times";
import {
  carregarPartida,
  carregarParticipantes,
  salvarEdicaoCompletaPartida,
  type Partida,
  type Participante,
  type ParticipanteEdicao,
} from "../lib/partidas";
import { Carregando, MensagemEstado } from "../components/Estado";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Avatar } from "../components/Avatar";
import { formatarDataCompleta } from "../lib/formatacao";

type FiltroModal = "todos" | "goleiros" | "linha" | "mensalistas" | "avulsos";

export function PartidaEditar() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantesOriginais, setParticipantesOriginais] = useState<Participante[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteEdicao[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmandoSalvar, setConfirmandoSalvar] = useState(false);

  // Modal de adição e diálogo de remoção
  const [modalTime, setModalTime] = useState<TimeId | null>(null);
  const [buscaJogador, setBuscaJogador] = useState("");
  const [filtroModal, setFiltroModal] = useState<FiltroModal>("todos");
  const [jogadorParaRemover, setJogadorParaRemover] = useState<ParticipanteEdicao | null>(null);

  useEffect(() => {
    if (!partidaId) return;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
    ])
      .then(([p, parts, ativos]) => {
        setPartida(p);
        setParticipantesOriginais(parts);
        setJogadoresAtivos(ativos);
        setParticipantes(
          parts.map((pt) => ({
            partida_id: pt.partida_id,
            jogador_id: pt.jogador_id,
            time: pt.time,
            posicao: pt.posicao,
            gols: pt.gols,
            assistencias: pt.assistencias,
            gols_contra: pt.gols_contra,
            status_confirmacao: pt.status_confirmacao,
            nome: pt.nome,
            username: pt.username,
          })),
        );
      })
      .catch((e) => setErro(e.message ?? String(e)))
      .finally(() => setCarregando(false));
  }, [partidaId]);

  const participantesPorTime = useMemo(() => {
    const map: Record<TimeId, ParticipanteEdicao[]> = { a: [], b: [] };
    for (const p of participantes) {
      if (p.time === "a" || p.time === "b") {
        map[p.time].push(p);
      }
    }
    for (const t of ["a", "b"] as TimeId[]) {
      map[t].sort((a, b) => {
        // Goleiros primeiro, depois ordem alfabética
        const aGk = a.posicao === "goleiro" ? 0 : 1;
        const bGk = b.posicao === "goleiro" ? 0 : 1;
        if (aGk !== bGk) return aGk - bGk;
        return (a.nome ?? "").localeCompare(b.nome ?? "");
      });
    }
    return map;
  }, [participantes]);

  // Placar derivado em tempo real
  const placarAoVivo = useMemo(() => {
    let placarA = 0;
    let placarB = 0;
    for (const p of participantes) {
      if (p.time === "a") {
        placarA += p.gols;
        placarB += p.gols_contra;
      } else if (p.time === "b") {
        placarB += p.gols;
        placarA += p.gols_contra;
      }
    }
    return { placarA, placarB };
  }, [participantes]);

  // Candidatos para inclusão no modal
  const candidatosAdicionar = useMemo(() => {
    const idsEscalados = new Set(participantes.map((p) => p.jogador_id));
    const termo = buscaJogador.trim().toLowerCase();

    return jogadoresAtivos
      .filter((j) => !idsEscalados.has(j.id))
      .filter((j) => {
        if (filtroModal === "goleiros") return j.posicao === "goleiro";
        if (filtroModal === "linha") return j.posicao !== "goleiro";
        if (filtroModal === "mensalistas") return j.is_mensalista;
        if (filtroModal === "avulsos") return !j.is_mensalista;
        return true;
      })
      .filter(
        (j) =>
          !termo ||
          j.nome.toLowerCase().includes(termo) ||
          j.username.toLowerCase().includes(termo),
      );
  }, [jogadoresAtivos, participantes, buscaJogador, filtroModal]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (partida?.status === "live") {
    return <Navigate to={`/partida/${partidaId}/ao-vivo`} replace />;
  }
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (erro && !partida)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Erro: {erro}
      </MensagemEstado>
    );
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );

  const primeiraVez = partida.status === "draft";

  function ajustar(
    jogadorId: number,
    campo: "gols" | "assistencias" | "gols_contra",
    delta: number,
  ) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const valorAtual = p[campo] ?? 0;
        return {
          ...p,
          [campo]: Math.max(0, valorAtual + delta),
        };
      }),
    );
  }

  function moverTime(jogadorId: number) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const novoTime: TimeId = p.time === "a" ? "b" : "a";
        return { ...p, time: novoTime };
      }),
    );
  }

  function tentarRemover(p: ParticipanteEdicao) {
    if (p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0) {
      setJogadorParaRemover(p);
    } else {
      removerJogador(p.jogador_id);
    }
  }

  function removerJogador(jogadorId: number) {
    setParticipantes((prev) => prev.filter((p) => p.jogador_id !== jogadorId));
    setJogadorParaRemover(null);
  }

  function adicionarJogador(jogador: JogadorLista, time: TimeId) {
    const novo: ParticipanteEdicao = {
      partida_id: partidaId,
      jogador_id: jogador.id,
      time,
      posicao: jogador.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
      status_confirmacao: "confirmado",
      nome: jogador.nome,
      username: jogador.username,
    };
    setParticipantes((prev) => [...prev, novo]);
    setModalTime(null);
    setBuscaJogador("");
    setFiltroModal("todos");
  }

  async function salvar() {
    setConfirmandoSalvar(false);
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    try {
      await salvarEdicaoCompletaPartida(
        partidaId,
        participantes,
        participantesOriginais,
        partida!.status,
        primeiraVez,
      );

      setFeedback(
        primeiraVez
          ? "Resultado e escalação publicados com sucesso!"
          : "Partida, escalação e placar salvos com sucesso.",
      );
      setTimeout(() => {
        navigate(`/partida/${partidaId}`);
      }, 700);
    } catch (e) {
      setErro("Erro ao salvar alterações: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-48 sm:px-4 max-w-2xl mx-auto space-y-5">
      {/* Navegação de retorno */}
      <Link
        to={`/partida/${partidaId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition"
      >
        ← Voltar para a partida
      </Link>

      {/* Placar & Cabeçalho Hero */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {primeiraVez ? "Lançamento de Resultado" : "Edição da Partida"} · #{partidaId}
          </span>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 capitalize">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </div>

        {/* Display do Placar ao Vivo */}
        <div className="flex items-center justify-between rounded-xl bg-neutral-100 dark:bg-neutral-950 p-3">
          {/* Time Preto */}
          <div className="flex items-center gap-2 flex-1">
            <span className="w-3.5 h-3.5 rounded-full bg-neutral-950 border border-neutral-600 shadow-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Preto
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {participantesPorTime.a.length} jogadores
              </p>
            </div>
          </div>

          {/* Números do Placar */}
          <div className="px-4 py-1 flex items-center gap-2 text-2xl sm:text-3xl font-black tabular-nums text-neutral-900 dark:text-neutral-100">
            <span>{placarAoVivo.placarA}</span>
            <span className="text-sm font-normal text-neutral-400">×</span>
            <span>{placarAoVivo.placarB}</span>
          </div>

          {/* Time Branco */}
          <div className="flex items-center justify-end gap-2 flex-1 text-right">
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Branco
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {participantesPorTime.b.length} jogadores
              </p>
            </div>
            <span className="w-3.5 h-3.5 rounded-full bg-white border border-neutral-300 shadow-xs shrink-0" />
          </div>
        </div>

        <p className="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
          Adicione/remova jogadores e ajuste os gols abaixo. O placar atualiza automaticamente.
        </p>
      </div>

      {partida.status === "closed" && (
        <MensagemEstado tipo="info">
          Partida encerrada — você está editando a escalação e o resultado de uma partida já finalizada.
        </MensagemEstado>
      )}

      {/* Seções dos Times */}
      <div className="space-y-6">
        {(["a", "b"] as TimeId[]).map((t) => {
          const lista = participantesPorTime[t];
          const goleiros = lista.filter((p) => p.posicao === "goleiro").length;
          const ehPreto = t === "a";
          const outroTimeNome = ehPreto ? "Branco" : "Preto";

          return (
            <section key={t} className="space-y-2.5">
              {/* Header do Time */}
              <div
                className="rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-xs"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: ehPreto ? "#f9fafb" : "#111827",
                  border: ehPreto ? "1px solid #374151" : "1px solid #e5e7eb",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight">
                    {TIMES[t].nome}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ehPreto
                        ? "bg-neutral-800 text-neutral-300 border border-neutral-700"
                        : "bg-neutral-200 text-neutral-800 border border-neutral-300"
                    }`}
                  >
                    {lista.length} jogadores {goleiros > 0 && `· 🧤 ${goleiros}`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBuscaJogador("");
                    setFiltroModal("todos");
                    setModalTime(t);
                  }}
                  className={`min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs active:scale-95 transition cursor-pointer ${
                    ehPreto
                      ? "bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700"
                      : "bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Adicionar</span>
                </button>
              </div>

              {/* Lista de Cards de Jogadores */}
              <div className="space-y-2">
                {lista.map((p) => {
                  const ehGoleiro = p.posicao === "goleiro";
                  const temEstatisticas =
                    p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0;

                  return (
                    <div
                      key={p.jogador_id}
                      className={`rounded-xl border p-3 bg-white dark:bg-neutral-900 transition shadow-2xs space-y-2.5 ${
                        temEstatisticas
                          ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/5 dark:border-amber-500/30"
                          : "border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      {/* Linha 1: Perfil do Jogador + Ações (Mover / Excluir) */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Identificação do Jogador */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar nome={p.nome ?? ""} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                                {p.nome ?? `#${p.jogador_id}`}
                              </span>
                              {temEstatisticas && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded shrink-0">
                                  {p.gols > 0 && `⚽ ${p.gols}`}
                                  {p.assistencias > 0 && `🅰️ ${p.assistencias}`}
                                  {p.gols_contra > 0 && `GC ${p.gols_contra}`}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                              {ehGoleiro ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  🧤 Goleiro
                                </span>
                              ) : (
                                <span>{POSICOES[p.posicao] ?? "Linha"}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moverTime(p.jogador_id)}
                            title={`Mover para o Time ${outroTimeNome}`}
                            className="min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 active:scale-95 transition cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3 h-3 text-neutral-500" />
                            <span>{outroTimeNome}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => tentarRemover(p)}
                            title="Remover jogador da partida"
                            className="min-h-0 p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 active:scale-95 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Linha 2: 3 Steppers Espaçosos (Gols, Assistências, Gols Contra) */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-3 gap-2">
                        <StepperBox
                          icone="⚽"
                          label="Gols"
                          valor={p.gols}
                          corAtiva="destaque"
                          onMenos={() => ajustar(p.jogador_id, "gols", -1)}
                          onMais={() => ajustar(p.jogador_id, "gols", 1)}
                        />
                        <StepperBox
                          icone="🅰️"
                          label="Assists"
                          valor={p.assistencias}
                          corAtiva="azul"
                          onMenos={() => ajustar(p.jogador_id, "assistencias", -1)}
                          onMais={() => ajustar(p.jogador_id, "assistencias", 1)}
                        />
                        <StepperBox
                          icone="🥅"
                          label="GC"
                          valor={p.gols_contra}
                          corAtiva="perigo"
                          onMenos={() => ajustar(p.jogador_id, "gols_contra", -1)}
                          onMais={() => ajustar(p.jogador_id, "gols_contra", 1)}
                        />
                      </div>
                    </div>
                  );
                })}

                {lista.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 p-6 text-center text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900/30">
                    <p className="mb-2">Nenhum jogador escalado no {TIMES[t].nome}.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setBuscaJogador("");
                        setFiltroModal("todos");
                        setModalTime(t);
                      }}
                      className="min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Adicionar primeiro jogador</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      {/* Barra Fixa Inferior de Salvar */}
      <div
        className="fixed inset-x-0 z-40 p-3 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 shadow-lg"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-1">
          <button
            onClick={() => setConfirmandoSalvar(true)}
            disabled={salvando}
            className="w-full rounded-xl bg-destaque hover:brightness-105 px-4 py-3.5 font-bold text-white shadow-sm disabled:opacity-40 active:scale-[.99] transition cursor-pointer text-sm"
          >
            {salvando
              ? "Salvando alterações…"
              : primeiraVez
                ? "Publicar resultado e escalação"
                : "Salvar alterações da partida"}
          </button>
          <p className="text-center text-[11px] text-neutral-500 dark:text-neutral-400">
            {primeiraVez
              ? "Publica o placar e abre a votação por 24 horas."
              : "Atualiza escalação, participantes e placar imediatamente."}
          </p>
        </div>
      </div>

      {/* Modal para Adicionar Jogador com Busca e Filtros Rápidos */}
      {modalTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-destaque" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Adicionar ao {TIMES[modalTime].nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalTime(null)}
                className="min-h-0 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca & Filtros */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2 bg-white dark:bg-neutral-900">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por nome ou apelido..."
                  value={buscaJogador}
                  onChange={(e) => setBuscaJogador(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-9 pr-8 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-destaque"
                />
                {buscaJogador && (
                  <button
                    type="button"
                    onClick={() => setBuscaJogador("")}
                    className="min-h-0 absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtros em Pílula */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                {(
                  [
                    { id: "todos", label: "Todos" },
                    { id: "goleiros", label: "🧤 Goleiros" },
                    { id: "linha", label: "Linha" },
                    { id: "mensalistas", label: "Mensalistas" },
                    { id: "avulsos", label: "Avulsos" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroModal(f.id)}
                    className={`min-h-0 px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition cursor-pointer ${
                      filtroModal === f.id
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista com scroll otimizado */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 p-2 space-y-1">
              {candidatosAdicionar.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => adicionarJogador(j, modalTime)}
                  className="w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/60 active:scale-[.99] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar nome={j.nome} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {j.nome}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {j.is_mensalista ? "Mensalista" : "Avulso"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      {j.posicao === "goleiro" ? "🧤 Goleiro" : POSICOES[j.posicao] ?? "Linha"}
                    </span>
                    <span className="min-h-0 px-2 py-1 rounded-md bg-destaque/15 text-destaque text-xs font-bold">
                      + Escalar
                    </span>
                  </div>
                </button>
              ))}

              {candidatosAdicionar.length === 0 && (
                <div className="py-12 text-center text-xs text-neutral-400">
                  {buscaJogador
                    ? "Nenhum jogador encontrado com essa busca."
                    : "Nenhum jogador disponível neste filtro."}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end bg-neutral-50 dark:bg-neutral-950">
              <button
                type="button"
                onClick={() => setModalTime(null)}
                className="min-h-0 px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação de Remoção */}
      <ConfirmDialog
        open={jogadorParaRemover != null}
        onClose={() => setJogadorParaRemover(null)}
        onConfirm={() => jogadorParaRemover && removerJogador(jogadorParaRemover.jogador_id)}
        titulo={`Remover ${jogadorParaRemover?.nome ?? "jogador"}?`}
        mensagem="Este jogador possui gols, assistências ou gols contra registrados. Se removê-lo da partida, essas estatísticas serão apagadas."
        textoConfirmar="Remover jogador"
        tomConfirmar="perigo"
      />

      {/* Diálogo de Confirmação de Salvamento */}
      <ConfirmDialog
        open={confirmandoSalvar}
        onClose={() => setConfirmandoSalvar(false)}
        onConfirm={salvar}
        titulo={primeiraVez ? "Publicar resultado e escalação?" : "Salvar alterações?"}
        mensagem={
          primeiraVez
            ? "Isso grava a escalação definitiva, o placar e abre o período de votação."
            : "Atualiza os jogadores escalados, seus times e o placar oficial desta partida."
        }
        textoConfirmar={primeiraVez ? "Publicar" : "Salvar"}
      />
    </div>
  );
}

// Componente Stepper em formato de Card para excelente UX Mobile
function StepperBox({
  icone,
  label,
  valor,
  corAtiva,
  disabled,
  onMenos,
  onMais,
}: {
  icone: string;
  label: string;
  valor: number;
  corAtiva: "destaque" | "azul" | "perigo";
  disabled?: boolean;
  onMenos: () => void;
  onMais: () => void;
}) {
  const ativo = valor > 0;

  const bgStyle = ativo
    ? corAtiva === "destaque"
      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60"
      : corAtiva === "azul"
        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700/60"
        : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/60"
    : "bg-neutral-50 dark:bg-neutral-950/50 border-neutral-200 dark:border-neutral-800";

  const numColor = ativo
    ? corAtiva === "destaque"
      ? "text-amber-700 dark:text-amber-300"
      : corAtiva === "azul"
        ? "text-blue-700 dark:text-blue-300"
        : "text-red-700 dark:text-red-300"
    : "text-neutral-700 dark:text-neutral-300";

  return (
    <div
      className={`rounded-xl border p-2 flex flex-col items-center justify-between transition ${bgStyle}`}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1">
        <span>{icone}</span>
        <span>{label}</span>
      </div>

      <div className="w-full flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onMenos}
          disabled={disabled || valor === 0}
          aria-label={`Diminuir ${label}`}
          className="min-h-0 h-8 w-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-bold flex items-center justify-center disabled:opacity-20 active:scale-95 transition shadow-2xs cursor-pointer"
        >
          −
        </button>

        <span className={`text-base font-black tabular-nums ${numColor}`}>
          {valor}
        </span>

        <button
          type="button"
          onClick={onMais}
          disabled={disabled}
          aria-label={`Aumentar ${label}`}
          className={`min-h-0 h-8 w-8 rounded-lg text-sm font-bold flex items-center justify-center active:scale-95 transition shadow-2xs cursor-pointer ${
            corAtiva === "destaque"
              ? "bg-destaque text-white hover:brightness-105"
              : corAtiva === "azul"
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-red-600 text-white hover:bg-red-500"
          } disabled:opacity-30`}
        >
          +
        </button>
      </div>
    </div>
  );
}
