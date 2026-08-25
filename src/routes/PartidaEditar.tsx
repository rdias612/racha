import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Trash2, ArrowLeftRight, Search, X } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import { TIMES, POSICOES, type TimeId } from '../lib/times';
import {
  carregarPartida,
  carregarParticipantes,
  salvarEdicaoCompletaPartida,
  type Partida,
  type Participante,
  type ParticipanteEdicao,
} from '../lib/partidas';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Avatar } from '../components/Avatar';
import { formatarDataCompleta } from '../lib/formatacao';
import { voltar } from '../lib/navegacao';

type FiltroModal = 'todos' | 'goleiros' | 'linha' | 'mensalistas' | 'avulsos';

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
  const [buscaJogador, setBuscaJogador] = useState('');
  const [filtroModal, setFiltroModal] = useState<FiltroModal>('todos');
  const [jogadorParaRemover, setJogadorParaRemover] = useState<ParticipanteEdicao | null>(null);

  useEffect(() => {
    if (!partidaId) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
    ])
      .then(([p, parts, ativos]) => {
        if (!ativo) return;
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
            username: pt.username,
          }))
        );
      })
      .catch((e) => {
        if (ativo) setErro(e.message ?? String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [partidaId]);

  const participantesPorTime = useMemo(() => {
    const map: Record<TimeId, ParticipanteEdicao[]> = { a: [], b: [] };
    for (const p of participantes) {
      if (p.time === 'a' || p.time === 'b') {
        map[p.time].push(p);
      }
    }
    for (const t of ['a', 'b'] as TimeId[]) {
      map[t].sort((a, b) => {
        // Goleiros primeiro, depois ordem alfabética
        const aGk = a.posicao === 'goleiro' ? 0 : 1;
        const bGk = b.posicao === 'goleiro' ? 0 : 1;
        if (aGk !== bGk) return aGk - bGk;
        return (a.username ?? '').localeCompare(b.username ?? '');
      });
    }
    return map;
  }, [participantes]);

  // Placar derivado em tempo real
  const placarAoVivo = useMemo(() => {
    let placarA = 0;
    let placarB = 0;
    for (const p of participantes) {
      if (p.time === 'a') {
        placarA += p.gols;
        placarB += p.gols_contra;
      } else if (p.time === 'b') {
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
        if (filtroModal === 'goleiros') return j.posicao === 'goleiro';
        if (filtroModal === 'linha') return j.posicao !== 'goleiro';
        if (filtroModal === 'mensalistas') return j.is_mensalista;
        if (filtroModal === 'avulsos') return !j.is_mensalista;
        return true;
      })
      .filter((j) => !termo || j.username.toLowerCase().includes(termo));
  }, [jogadoresAtivos, participantes, buscaJogador, filtroModal]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (partida?.status === 'live') {
    return <Navigate to={`/partida/${partidaId}/ao-vivo`} replace />;
  }
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (erro && !partida)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">Erro: {erro}</MensagemEstado>
    );
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );

  const primeiraVez = partida.status === 'draft';

  function ajustar(
    jogadorId: number,
    campo: 'gols' | 'assistencias' | 'gols_contra',
    delta: number
  ) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const valorAtual = p[campo] ?? 0;
        return {
          ...p,
          [campo]: Math.max(0, valorAtual + delta),
        };
      })
    );
  }

  function moverTime(jogadorId: number) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const novoTime: TimeId = p.time === 'a' ? 'b' : 'a';
        return { ...p, time: novoTime };
      })
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
      status_confirmacao: 'confirmado',
      username: jogador.username,
    };
    setParticipantes((prev) => [...prev, novo]);
    setModalTime(null);
    setBuscaJogador('');
    setFiltroModal('todos');
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
        primeiraVez
      );

      setFeedback(
        primeiraVez
          ? 'Resultado e escalação publicados com sucesso!'
          : 'Partida, escalação e placar salvos com sucesso.'
      );
      setTimeout(() => {
        navigate(`/partida/${partidaId}`);
      }, 700);
    } catch (e) {
      setErro('Erro ao salvar alterações: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-48 sm:px-4 max-w-2xl mx-auto space-y-5">
      {/* Navegação de retorno */}
      <button
        onClick={() => voltar(navigate, `/partida/${partidaId}`)}
        className="text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        ← Voltar para a partida
      </button>

      {/* Placar & Cabeçalho Hero */}
      <div className="rounded-[4px] border border-borda bg-superficie p-4 shadow-carimbo space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
            {primeiraVez ? 'Lançamento de Resultado' : 'Edição da Partida'} · #{partidaId}
          </span>
          <span className="text-xs font-mono text-giz-fraco capitalize">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </div>

        {/* Display do Placar ao Vivo */}
        <div className="flex items-center justify-between rounded-[4px] bg-[#000000] border border-borda p-3">
          {/* Time Preto */}
          <div className="flex items-center gap-2 flex-1">
            <span className="w-3.5 h-3.5 rounded-[2px] bg-[#0d0d0e] border border-[#35302a] shadow-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-display font-bold uppercase tracking-wider text-[#f4f1e8] truncate">
                Preto
              </p>
              <p className="text-[10px] font-mono text-giz-fraco">
                {participantesPorTime.a.length} jogadores
              </p>
            </div>
          </div>

          {/* Números do Placar */}
          <div className="px-4 py-1 flex items-center gap-2 text-2xl sm:text-3xl font-display font-black tabular-nums text-destaque">
            <span>{placarAoVivo.placarA}</span>
            <span className="text-sm font-normal text-giz-fraco">×</span>
            <span>{placarAoVivo.placarB}</span>
          </div>

          {/* Time Branco */}
          <div className="flex items-center justify-end gap-2 flex-1 text-right">
            <div className="min-w-0">
              <p className="text-xs font-display font-bold uppercase tracking-wider text-[#f4f1e8] truncate">
                Branco
              </p>
              <p className="text-[10px] font-mono text-giz-fraco">
                {participantesPorTime.b.length} jogadores
              </p>
            </div>
            <span className="w-3.5 h-3.5 rounded-[2px] bg-[#f4f1e8] border border-[#d8d2c0] shadow-xs shrink-0" />
          </div>
        </div>

        <p className="text-center text-[11px] font-mono text-giz-fraco">
          Adicione/remova jogadores e ajuste os gols abaixo. O placar atualiza automaticamente.
        </p>
      </div>

      {partida.status === 'closed' && (
        <MensagemEstado tipo="info">
          Partida encerrada — você está editando a escalação e o resultado de uma partida já
          finalizada.
        </MensagemEstado>
      )}

      {/* Seções dos Times */}
      <div className="space-y-6">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const lista = participantesPorTime[t];
          const goleiros = lista.filter((p) => p.posicao === 'goleiro').length;
          const ehPreto = t === 'a';
          const outroTimeNome = ehPreto ? 'Branco' : 'Preto';

          return (
            <section key={t} className="space-y-2.5">
              {/* Header do Time */}
              <div
                className="rounded-[4px] px-3.5 py-2.5 flex items-center justify-between shadow-carimbo border border-borda"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: ehPreto ? '#f4f1e8' : '#0d0d0e',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-display font-bold uppercase tracking-wider">
                    {TIMES[t].nome}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-[2px] font-mono font-medium ${
                      ehPreto
                        ? 'bg-superficie text-giz border border-borda'
                        : 'bg-superficie-2 text-giz border border-borda'
                    }`}
                  >
                    {lista.length} jogadores {goleiros > 0 && `· 🧤 ${goleiros}`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBuscaJogador('');
                    setFiltroModal('todos');
                    setModalTime(t);
                  }}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider shadow-carimbo active:translate-y-px transition cursor-pointer ${
                    ehPreto
                      ? 'bg-superficie text-giz border border-borda hover:bg-superficie-2'
                      : 'bg-[#0d0d0e] hover:bg-[#1b1814] text-[#f4f1e8] border border-[#0d0d0e]'
                  }`}
                >
                  <UserPlus className="size-3.5 text-destaque" />
                  <span>+ Adicionar</span>
                </button>
              </div>

              {/* Lista de Cards de Jogadores */}
              <div className="space-y-2">
                {lista.map((p) => {
                  const ehGoleiro = p.posicao === 'goleiro';
                  const temEstatisticas = p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0;

                  return (
                    <div
                      key={p.jogador_id}
                      className={`rounded-[4px] border p-3 bg-superficie transition shadow-carimbo space-y-2.5 ${
                        temEstatisticas ? 'border-destaque/60 bg-destaque/5' : 'border-borda'
                      }`}
                    >
                      {/* Linha 1: Perfil do Jogador + Ações (Mover / Excluir) */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Identificação do Jogador */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar username={p.username ?? ''} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-giz truncate">
                                {p.username ? `@${p.username}` : `#${p.jogador_id}`}
                              </span>
                              {temEstatisticas && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-destaque bg-destaque/10 border border-destaque/30 px-1.5 py-0.2 rounded-[2px] shrink-0">
                                  {p.gols > 0 && `⚽ ${p.gols}`}
                                  {p.assistencias > 0 && `🅰️ ${p.assistencias}`}
                                  {p.gols_contra > 0 && `GC ${p.gols_contra}`}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-display uppercase tracking-wider text-giz-fraco flex items-center gap-1">
                              {ehGoleiro ? (
                                <span className="text-ok font-bold">🧤 Goleiro</span>
                              ) : (
                                <span>{POSICOES[p.posicao] ?? 'Linha'}</span>
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
                            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] border border-borda bg-superficie-2 text-[11px] font-display font-bold uppercase tracking-wider text-giz hover:text-destaque active:translate-y-px transition cursor-pointer shadow-carimbo"
                          >
                            <ArrowLeftRight className="size-3.5 text-destaque" />
                            <span>{outroTimeNome}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => tentarRemover(p)}
                            title="Remover jogador da partida"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-[3px] border border-perigo/40 bg-superficie-2 text-perigo hover:bg-perigo/10 active:translate-y-px transition cursor-pointer shadow-carimbo"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Linha 2: 3 Steppers Espaçosos (Gols, Assistências, Gols Contra) */}
                      <div className="pt-2 border-t border-borda grid grid-cols-3 gap-2">
                        <StepperBox
                          icone="⚽"
                          label="Gols"
                          valor={p.gols}
                          corAtiva="destaque"
                          onMenos={() => ajustar(p.jogador_id, 'gols', -1)}
                          onMais={() => ajustar(p.jogador_id, 'gols', 1)}
                        />
                        <StepperBox
                          icone="🅰️"
                          label="Assists"
                          valor={p.assistencias}
                          corAtiva="azul"
                          onMenos={() => ajustar(p.jogador_id, 'assistencias', -1)}
                          onMais={() => ajustar(p.jogador_id, 'assistencias', 1)}
                        />
                        <StepperBox
                          icone="🥅"
                          label="GC"
                          valor={p.gols_contra}
                          corAtiva="perigo"
                          onMenos={() => ajustar(p.jogador_id, 'gols_contra', -1)}
                          onMais={() => ajustar(p.jogador_id, 'gols_contra', 1)}
                        />
                      </div>
                    </div>
                  );
                })}

                {lista.length === 0 && (
                  <div className="rounded-[4px] border border-dashed border-borda p-6 text-center text-xs text-giz-fraco bg-superficie-2">
                    <p className="mb-2 font-mono">Nenhum jogador escalado no {TIMES[t].nome}.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setBuscaJogador('');
                        setFiltroModal('todos');
                        setModalTime(t);
                      }}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider bg-destaque text-destaque-tinta shadow-carimbo cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
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
        className="fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-1">
          <button
            onClick={() => setConfirmandoSalvar(true)}
            disabled={salvando}
            className="w-full min-h-[44px] rounded-[4px] bg-destaque hover:brightness-105 px-4 py-3 font-display font-bold uppercase tracking-wider text-destaque-tinta shadow-carimbo disabled:opacity-40 active:translate-y-px transition cursor-pointer text-xs"
          >
            {salvando
              ? 'Salvando alterações…'
              : primeiraVez
                ? 'Publicar resultado e escalação'
                : 'Salvar alterações da partida'}
          </button>
          <p className="text-center text-[10px] font-mono text-giz-fraco">
            {primeiraVez
              ? 'Publica o placar e abre a votação por 24 horas.'
              : 'Atualiza escalação, participantes e placar imediatamente.'}
          </p>
        </div>
      </div>

      {/* Modal para Adicionar Jogador com Busca e Filtros Rápidos */}
      {modalTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[4px] border border-borda bg-superficie shadow-carimbo-preto overflow-hidden text-giz">
            {/* Cabeçalho do Modal */}
            <div className="p-4 border-b border-borda flex items-center justify-between bg-superficie-2">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-destaque" />
                <h3 className="text-sm font-display font-bold uppercase tracking-wider text-giz">
                  Adicionar ao {TIMES[modalTime].nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalTime(null)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] text-giz-fraco hover:text-giz cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Busca & Filtros */}
            <div className="p-3 border-b border-borda space-y-2 bg-superficie">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-giz-fraco" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por @username..."
                  value={buscaJogador}
                  onChange={(e) => setBuscaJogador(e.target.value)}
                  className="w-full rounded-[4px] border border-borda bg-superficie-2 pl-9 pr-8 py-2 text-sm text-giz placeholder-giz-fraco focus:outline-none focus:border-destaque"
                />
                {buscaJogador && (
                  <button
                    type="button"
                    onClick={() => setBuscaJogador('')}
                    aria-label="Limpar busca"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-xs text-giz-fraco hover:text-giz"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtros em Pílula */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                {(
                  [
                    { id: 'todos', label: 'Todos' },
                    { id: 'goleiros', label: '🧤 Goleiros' },
                    { id: 'linha', label: 'Linha' },
                    { id: 'mensalistas', label: 'Mensalistas' },
                    { id: 'avulsos', label: 'Avulsos' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroModal(f.id)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-[3px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
                      filtroModal === f.id
                        ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                        : 'bg-superficie-2 border border-borda text-giz-fraco hover:text-giz'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista com scroll otimizado */}
            <div className="flex-1 overflow-y-auto divide-y divide-borda p-2 space-y-1">
              {candidatosAdicionar.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => adicionarJogador(j, modalTime)}
                  className="w-full p-2.5 rounded-[3px] flex items-center justify-between gap-3 text-left hover:bg-superficie-2 active:translate-y-px transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar username={j.username} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-giz truncate">@{j.username}</p>
                      <p className="text-[10px] font-mono text-giz-fraco">
                        {j.is_mensalista ? 'Mensalista' : 'Avulso'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                      {j.posicao === 'goleiro' ? '🧤 Goleiro' : (POSICOES[j.posicao] ?? 'Linha')}
                    </span>
                    <span className="min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-[2px] bg-destaque/15 text-destaque text-xs font-display font-bold uppercase tracking-wider">
                      + Escalar
                    </span>
                  </div>
                </button>
              ))}

              {candidatosAdicionar.length === 0 && (
                <div className="py-12 text-center text-xs font-mono text-giz-fraco">
                  {buscaJogador
                    ? 'Nenhum jogador encontrado com essa busca.'
                    : 'Nenhum jogador disponível neste filtro.'}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 border-t border-borda flex justify-end bg-superficie-2">
              <button
                type="button"
                onClick={() => setModalTime(null)}
                className="min-h-[44px] px-4 py-2 rounded-[3px] border border-borda text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie cursor-pointer"
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
        titulo={`Remover ${jogadorParaRemover?.username ? `@${jogadorParaRemover.username}` : 'jogador'}?`}
        mensagem="Este jogador possui gols, assistências ou gols contra registrados. Se removê-lo da partida, essas estatísticas serão apagadas."
        textoConfirmar="Remover jogador"
        tomConfirmar="perigo"
      />

      {/* Diálogo de Confirmação de Salvamento */}
      <ConfirmDialog
        open={confirmandoSalvar}
        onClose={() => setConfirmandoSalvar(false)}
        onConfirm={salvar}
        titulo={primeiraVez ? 'Publicar resultado e escalação?' : 'Salvar alterações?'}
        mensagem={
          primeiraVez
            ? 'Isso grava a escalação definitiva, o placar e abre o período de votação.'
            : 'Atualiza os jogadores escalados, seus times e o placar oficial desta partida.'
        }
        textoConfirmar={primeiraVez ? 'Publicar' : 'Salvar'}
      />
    </div>
  );
}

// Componente Stepper em formato de Card para excelente UX Mobile com alvos de 44px
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
  corAtiva: 'destaque' | 'azul' | 'perigo';
  disabled?: boolean;
  onMenos: () => void;
  onMais: () => void;
}) {
  const ativo = valor > 0;

  const bgStyle = ativo
    ? corAtiva === 'destaque'
      ? 'bg-destaque/10 border-destaque/60 text-destaque'
      : corAtiva === 'azul'
        ? 'bg-superficie-2 border-destaque text-giz'
        : 'bg-perigo/10 border-perigo/60 text-perigo'
    : 'bg-superficie-2 border-borda text-giz-fraco';

  const numColor = ativo
    ? corAtiva === 'destaque'
      ? 'text-destaque font-bold'
      : corAtiva === 'azul'
        ? 'text-giz font-bold'
        : 'text-perigo font-bold'
    : 'text-giz';

  return (
    <div
      className={`rounded-[4px] border p-2 flex flex-col items-center justify-between transition ${bgStyle}`}
    >
      <div className="flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
        <span>{icone}</span>
        <span>{label}</span>
      </div>

      <div className="w-full flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onMenos}
          disabled={disabled || valor === 0}
          aria-label={`Diminuir ${label}`}
          className="min-h-[44px] min-w-[44px] rounded-[3px] border border-borda bg-superficie text-giz text-sm font-bold flex items-center justify-center disabled:opacity-20 active:translate-y-px transition shadow-carimbo cursor-pointer"
        >
          −
        </button>

        <span className={`text-base font-mono font-black tabular-nums ${numColor}`}>{valor}</span>

        <button
          type="button"
          onClick={onMais}
          disabled={disabled}
          aria-label={`Aumentar ${label}`}
          className={`min-h-[44px] min-w-[44px] rounded-[3px] text-sm font-bold flex items-center justify-center active:translate-y-px transition shadow-carimbo cursor-pointer ${
            corAtiva === 'destaque'
              ? 'bg-destaque text-destaque-tinta hover:brightness-105 border border-destaque'
              : corAtiva === 'azul'
                ? 'bg-superficie text-giz hover:bg-superficie-2 border border-borda'
                : 'bg-perigo text-white hover:bg-perigo/90 border border-perigo'
          } disabled:opacity-30`}
        >
          +
        </button>
      </div>
    </div>
  );
}
