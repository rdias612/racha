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
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { isSuperAdmin, listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
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
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";

export function PartidaEditar() {
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();
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
      map[t].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
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

  // Candidatos para inclusão (ativos que ainda não estão escalados)
  const candidatosAdicionar = useMemo(() => {
    const idsEscalados = new Set(participantes.map((p) => p.jogador_id));
    const termo = buscaJogador.trim().toLowerCase();
    return jogadoresAtivos
      .filter((j) => !idsEscalados.has(j.id))
      .filter(
        (j) =>
          !termo ||
          j.nome.toLowerCase().includes(termo) ||
          j.username.toLowerCase().includes(termo),
      );
  }, [jogadoresAtivos, participantes, buscaJogador]);

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

  const bloqueado =
    partida.status === "closed" && !isSuperAdmin(jogadorLogado?.username);
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
          ? "Resultado publicado com sucesso!"
          : "Partida e escalação salvas com sucesso.",
      );
      setTimeout(() => {
        navigate(`/partida/${partidaId}`);
      }, 700);
    } catch (e: any) {
      setErro("Erro ao salvar alterações: " + (e?.message ?? String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-44 sm:px-4 max-w-2xl mx-auto space-y-4">
      <Link
        to={`/partida/${partidaId}`}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {primeiraVez ? "Lançar resultado & Escalação" : "Editar partida"} · Partida #
            {partidaId}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
            <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
            <span className="hidden sm:inline">
              {formatarDataCompleta(partida.data_jogo)}
            </span>
          </p>
        </div>

        {/* Placar em Tempo Real */}
        <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-xs font-semibold">
          <span className="text-neutral-900 dark:text-neutral-100">
            Preto {placarAoVivo.placarA}
          </span>
          <span className="text-neutral-400">×</span>
          <span className="text-neutral-900 dark:text-neutral-100">
            {placarAoVivo.placarB} Branco
          </span>
        </div>
      </div>

      {bloqueado && (
        <MensagemEstado tipo="info">
          Partida encerrada — apenas superadministradores podem editar a escalação e resultado.
        </MensagemEstado>
      )}

      {/* Times + steppers + controles por jogador */}
      <div className="space-y-4">
        {(["a", "b"] as TimeId[]).map((t) => {
          const lista = participantesPorTime[t];
          const goleiros = lista.filter((p) => p.posicao === "goleiro").length;
          const ehPreto = t === "a";

          return (
            <div
              key={t}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs"
            >
              {/* Cabeçalho do Time */}
              <div
                className="px-3 py-2.5 text-xs font-semibold flex items-center justify-between"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: ehPreto ? "#f9fafb" : "#111827",
                }}
              >
                <div className="flex items-center gap-2">
                  <span>{TIMES[t].nome}</span>
                  <span className="opacity-80 font-normal">
                    ({lista.length} jogadores{goleiros > 0 ? ` · 🧤 ${goleiros}` : ""})
                  </span>
                </div>

                {!bloqueado && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaJogador("");
                      setModalTime(t);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition active:scale-95 cursor-pointer ${
                      ehPreto
                        ? "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                        : "bg-neutral-200 hover:bg-neutral-300 text-neutral-900 border border-neutral-300"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Jogador</span>
                  </button>
                )}
              </div>

              {/* Lista dos Jogadores do Time */}
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {lista.map((p) => {
                  const ehGoleiro = p.posicao === "goleiro";
                  return (
                    <div
                      key={p.jogador_id}
                      className="px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      {/* Identificação do Jogador */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar nome={p.nome ?? ""} size="xs" posicao={p.posicao} />
                        <div className="min-w-0 flex flex-col">
                          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {p.nome ?? `#${p.jogador_id}`}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-mono">
                            {ehGoleiro ? "🧤 Goleiro" : POSICOES[p.posicao] ?? "Linha"}
                          </span>
                        </div>
                      </div>

                      {/* Steppers de Gols, Assists, Gols Contra */}
                      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                        <Stepper
                          label="⚽"
                          title="Gol"
                          valor={p.gols}
                          tom="destaque"
                          disabled={bloqueado}
                          onMais={() => ajustar(p.jogador_id, "gols", 1)}
                          onMenos={() => ajustar(p.jogador_id, "gols", -1)}
                        />
                        <Stepper
                          label="🅰️"
                          title="Assistência"
                          valor={p.assistencias}
                          tom="neutro"
                          disabled={bloqueado}
                          onMais={() => ajustar(p.jogador_id, "assistencias", 1)}
                          onMenos={() => ajustar(p.jogador_id, "assistencias", -1)}
                        />
                        <Stepper
                          label="GC"
                          title="Gol contra"
                          valor={p.gols_contra}
                          tom="perigo"
                          disabled={bloqueado}
                          onMais={() => ajustar(p.jogador_id, "gols_contra", 1)}
                          onMenos={() => ajustar(p.jogador_id, "gols_contra", -1)}
                        />

                        {/* Ações de Gestão (Trocar Time / Remover) */}
                        {!bloqueado && (
                          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-neutral-200 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => moverTime(p.jogador_id)}
                              title={
                                p.time === "a"
                                  ? "Mover para o Time Branco"
                                  : "Mover para o Time Preto"
                              }
                              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 active:scale-95 transition cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => tentarRemover(p)}
                              title="Remover jogador da partida"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {lista.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
                    Nenhum jogador escalado neste time.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      {/* Barra Fixa Inferior de Salvar */}
      {!bloqueado && (
        <div
          className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setConfirmandoSalvar(true)}
              disabled={salvando}
              className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition cursor-pointer"
            >
              {salvando
                ? "Salvando alterações…"
                : primeiraVez
                  ? "Publicar resultado e escalação"
                  : "Salvar alterações"}
            </button>
            {primeiraVez && (
              <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Publica o placar e abre a votação por 24h.
              </p>
            )}
            {!primeiraVez && (
              <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Atualiza os participantes, placar e estatísticas.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Adicionar Jogador */}
      {modalTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[var(--cor-destaque)]" />
                Adicionar ao {TIMES[modalTime].nome}
              </h3>
              <button
                type="button"
                onClick={() => setModalTime(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar jogador por nome..."
                value={buscaJogador}
                onChange={(e) => setBuscaJogador(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--cor-destaque)]"
              />
            </div>

            {/* Lista de Jogadores Candidatos */}
            <div className="max-h-64 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
              {candidatosAdicionar.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => adicionarJogador(j, modalTime)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[.99] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar nome={j.nome} size="xs" posicao={j.posicao} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                        {j.nome}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {j.is_mensalista ? "Mensalista" : "Avulso"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase text-neutral-400 shrink-0">
                    {j.posicao === "goleiro" ? "🧤 Goleiro" : POSICOES[j.posicao] ?? "Linha"}
                  </span>
                </button>
              ))}

              {candidatosAdicionar.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-neutral-400">
                  {buscaJogador ? "Nenhum jogador encontrado." : "Todos os jogadores ativos já estão escalados."}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setModalTime(null)}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de Remoção de Jogador com Estatísticas */}
      <ConfirmDialog
        open={jogadorParaRemover != null}
        onClose={() => setJogadorParaRemover(null)}
        onConfirm={() => jogadorParaRemover && removerJogador(jogadorParaRemover.jogador_id)}
        titulo={`Remover ${jogadorParaRemover?.nome ?? "jogador"}?`}
        mensagem="Este jogador possui gols, assistências ou gols contra registrados. Ao removê-lo da partida, essas estatísticas serão excluídas."
        textoConfirmar="Remover da partida"
        tomConfirmar="perigo"
      />

      {/* Confirmação de Salvamento Geral */}
      <ConfirmDialog
        open={confirmandoSalvar}
        onClose={() => setConfirmandoSalvar(false)}
        onConfirm={salvar}
        titulo={primeiraVez ? "Publicar resultado e escalação?" : "Salvar alterações?"}
        mensagem={
          primeiraVez
            ? "Isso grava a escalação, o placar e abre a votação por 24h."
            : "Atualiza os jogadores escalados, seus times e o placar desta partida."
        }
        textoConfirmar={primeiraVez ? "Publicar" : "Salvar"}
      />
    </div>
  );
}

function Stepper({
  label,
  title,
  valor,
  tom,
  disabled,
  onMais,
  onMenos,
}: {
  label: string;
  title: string;
  valor: number;
  tom: "destaque" | "neutro" | "perigo";
  disabled?: boolean;
  onMais: () => void;
  onMenos: () => void;
}) {
  const cor =
    tom === "perigo"
      ? "text-red-600 dark:text-red-400"
      : tom === "destaque"
        ? "text-[var(--cor-destaque)]"
        : "text-neutral-500 dark:text-neutral-400";
  return (
    <div
      className="flex flex-col items-center"
      title={`${title}: ${valor}`}
    >
      <span className={`text-[10px] font-semibold leading-none ${cor}`}>
        {label}
      </span>
      <div className="flex items-center gap-0.5 mt-0.5">
        <button
          type="button"
          onClick={onMenos}
          disabled={disabled || valor === 0}
          aria-label={`Diminuir ${title}`}
          className="min-h-[34px] min-w-[26px] rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs disabled:opacity-30 active:scale-95 transition cursor-pointer"
        >
          −
        </button>
        <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {valor}
        </span>
        <button
          type="button"
          onClick={onMais}
          disabled={disabled}
          aria-label={`Aumentar ${title}`}
          className={`min-h-[34px] min-w-[26px] rounded-md border text-xs font-bold active:scale-95 transition disabled:opacity-30 cursor-pointer ${
            tom === "perigo"
              ? "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
              : tom === "destaque"
                ? "border-[var(--cor-destaque)] text-[var(--cor-destaque)]"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}
