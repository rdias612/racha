import { useEffect, useMemo, useState } from 'react';
import { POSICOES } from '../lib/times';
import {
  compararPorPresencaRecente,
  listarJogadoresAtivos,
  obterPartidasRecentesJogadores,
  type JogadorLista,
} from '../lib/jogadores';
import {
  adminDefinirConfirmacao,
  adicionarParticipante,
  confirmarPresenca,
  podeConfirmar,
  removerParticipanteDraft,
  vagasOcupadas,
  CAPACIDADE_PARTIDA,
  STATUS_CONFIRMACAO_LABEL,
  type Partida,
  type Participante,
  type StatusConfirmacao,
} from '../lib/partidas';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { formatarFechamento } from '../lib/formatacao';
import { vibrateLight, vibrateSuccess } from '../lib/haptics';
import { formatarMensagemErro } from '../lib/erros';

type PropsBotoes = {
  status: StatusConfirmacao;
  podeConf: boolean;
  ocupadas: number;
  processando: boolean;
  onAtualizar: (alvo: StatusConfirmacao) => void;
};

// Botões do próprio jogador (confirma/desconfirma/recusa a própria presença).
function BotoesSelf({ status, podeConf, ocupadas, processando, onAtualizar }: PropsBotoes) {
  const btn =
    'min-h-[44px] rounded-[3px] border px-3 text-xs font-display font-bold uppercase tracking-wider active:translate-y-px transition disabled:opacity-40';
  const lotado = ocupadas >= CAPACIDADE_PARTIDA;
  return (
    <>
      {status !== 'confirmado' && (
        <button
          type="button"
          disabled={processando || !podeConf}
          onClick={() => onAtualizar('confirmado')}
          title={lotado ? 'Vagas esgotadas' : undefined}
          className={`${btn} border-destaque bg-destaque/15 text-destaque-texto shadow-xs hover:bg-destaque hover:text-destaque-tinta`}
        >
          Vou jogar
        </button>
      )}
      {status === 'confirmado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('pendente')}
          className={`${btn} border-borda bg-superficie-2 text-giz-fraco hover:text-giz`}
        >
          Desconfirmar
        </button>
      )}
      {status !== 'recusado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => onAtualizar('recusado')}
          className={`${btn} border-perigo/40 text-perigo hover:bg-perigo/10`}
        >
          Essa quinta não rola
        </button>
      )}
    </>
  );
}

// Controles do admin (pode mexer em qualquer jogador com alvos de 44px).
function BotoesAdmin({
  status,
  podeConf,
  processando,
  onAtualizar,
  onRemover,
}: PropsBotoes & { onRemover?: () => void }) {
  const mini =
    'min-h-[44px] min-w-[44px] rounded-[3px] border text-xs font-display font-bold uppercase active:translate-y-px transition disabled:opacity-30 flex items-center justify-center';
  const off = 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={processando || (status !== 'confirmado' && !podeConf)}
        onClick={() => onAtualizar('confirmado')}
        title="Confirmar"
        className={`${mini} ${
          status === 'confirmado' ? 'border-ok bg-ok/20 text-ok font-bold' : off
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => onAtualizar('pendente')}
        title="Pendente"
        className={`${mini} ${
          status === 'pendente'
            ? 'border-destaque bg-destaque/20 text-destaque-texto font-bold'
            : off
        }`}
      >
        ⏳
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => onAtualizar('recusado')}
        title="Não vai"
        className={`${mini} ${
          status === 'recusado' ? 'border-perigo bg-perigo/20 text-perigo font-bold' : off
        }`}
      >
        ✗
      </button>
      {onRemover && (
        <button
          type="button"
          disabled={processando}
          onClick={onRemover}
          title="Remover convite"
          className={`${mini} ${off} hover:border-perigo hover:text-perigo`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export interface ConfirmacoesPartidaProps {
  partida: Partida;
  participantes: Participante[];
  jogadorLogadoId: number | null;
  isAdmin: boolean;
  onAtualizar: () => Promise<void> | void;
}

export function ConfirmacoesPartida({
  partida,
  participantes,
  jogadorLogadoId,
  isAdmin,
  onAtualizar,
}: ConfirmacoesPartidaProps) {
  const [participantesLocais, setParticipantesLocais] = useState<Participante[]>(participantes);
  const [processando, setProcessando] = useState<number | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [mostrandoAvulso, setMostrandoAvulso] = useState(false);
  const [todosAtivos, setTodosAtivos] = useState<JogadorLista[]>([]);
  const [partidasRecentes, setPartidasRecentes] = useState<Record<number, number>>({});

  useEffect(() => {
    setParticipantesLocais(participantes);
  }, [participantes]);

  const closesAt = partida.confirmacao_closes_at;
  const agora = new Date();
  const prazoPassou = !!closesAt && agora.getTime() >= new Date(closesAt).getTime();
  const ocupadas = vagasOcupadas(participantesLocais);
  const livres = Math.max(0, CAPACIDADE_PARTIDA - ocupadas);

  const ordenados = useMemo(() => {
    const peso = (s: StatusConfirmacao) => (s === 'confirmado' ? 0 : s === 'pendente' ? 1 : 2);
    return [...participantesLocais].sort(
      (a, b) =>
        peso(a.status_confirmacao) - peso(b.status_confirmacao) ||
        (a.username ?? '').localeCompare(b.username ?? '')
    );
  }, [participantesLocais]);

  async function atualizar(jogadorId: number, alvo: StatusConfirmacao) {
    setErroLocal(null);
    setProcessando(jogadorId);
    if (alvo === 'confirmado') vibrateSuccess();
    else vibrateLight();

    // Atualização otimista imediata
    const anterior = participantesLocais;
    setParticipantesLocais((prev) =>
      prev.map((p) => (p.jogador_id === jogadorId ? { ...p, status_confirmacao: alvo } : p))
    );

    try {
      const ehSelf = jogadorId === jogadorLogadoId;
      const ok =
        !ehSelf && isAdmin && jogadorLogadoId != null
          ? await adminDefinirConfirmacao(partida.id, jogadorId, alvo, jogadorLogadoId)
          : await confirmarPresenca(partida.id, jogadorId, alvo);
      if (!ok) {
        setParticipantesLocais(anterior); // Rollback
        setErroLocal('Não foi possível atualizar — confira as vagas disponíveis.');
      } else {
        await onAtualizar();
      }
    } catch (e) {
      setParticipantesLocais(anterior); // Rollback
      setErroLocal(formatarMensagemErro(e));
    } finally {
      setProcessando(null);
    }
  }

  async function remover(jogadorId: number) {
    setErroLocal(null);
    setProcessando(jogadorId);
    try {
      await removerParticipanteDraft(partida.id, jogadorId);
      await onAtualizar();
    } catch (e) {
      setErroLocal(formatarMensagemErro(e));
    } finally {
      setProcessando(null);
    }
  }

  async function adicionar(jogadorId: number) {
    setErroLocal(null);
    setProcessando(jogadorId);
    try {
      const ok = await adicionarParticipante(partida.id, jogadorId);
      if (!ok) {
        setErroLocal('Não foi possível adicionar — pode não haver vaga.');
      } else {
        setMostrandoAvulso(false);
        await onAtualizar();
      }
    } catch (e) {
      setErroLocal(formatarMensagemErro(e, 'Não foi possível adicionar o participante.'));
    } finally {
      setProcessando(null);
    }
  }

  async function abrirAvulso() {
    setMostrandoAvulso((v) => !v);
    if (todosAtivos.length === 0) {
      try {
        const [jogadores, recentes] = await Promise.all([
          listarJogadoresAtivos(),
          obterPartidasRecentesJogadores(2),
        ]);
        setTodosAtivos(jogadores);
        setPartidasRecentes(recentes);
      } catch {
        /* ignora erro de listagem */
      }
    }
  }

  const candidatosAvulso = useMemo(() => {
    const idsNoElenco = new Set(participantesLocais.map((p) => p.jogador_id));
    return todosAtivos
      .filter((j) => !idsNoElenco.has(j.id))
      .sort(compararPorPresencaRecente(partidasRecentes));
  }, [participantesLocais, todosAtivos, partidasRecentes]);

  return (
    <section className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo">
      <div className="px-3 py-2 bg-superficie-2 border-b border-borda flex items-center justify-between">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          Confirmações de Presença
        </h3>
        <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
          {ocupadas}/{CAPACIDADE_PARTIDA} vagas
        </span>
      </div>

      {closesAt && (
        <p className="px-3 pt-2 text-[11px] font-mono text-giz-fraco">
          {prazoPassou
            ? 'Prazo encerrado — vagas remanescentes liberadas (primeiro a confirmar leva).'
            : `Reservas liberadas ${formatarFechamento(closesAt)}.`}
        </p>
      )}

      <div className="divide-y divide-borda">
        {ordenados.map((p) => {
          const ehSelf = p.jogador_id === jogadorLogadoId;
          const podeConf = podeConfirmar(p, 'confirmado', participantes);
          return (
            <div
              key={p.jogador_id}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-superficie-2 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar username={p.username ?? ''} size="xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-giz">
                    {p.username || `#${p.jogador_id}`}
                    {ehSelf && (
                      <span className="ml-1 text-[10px] font-mono text-destaque-texto">(você)</span>
                    )}
                  </p>
                  <Badge variante="status" status={p.status_confirmacao}>
                    {STATUS_CONFIRMACAO_LABEL[p.status_confirmacao]}
                  </Badge>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {ehSelf ? (
                  <BotoesSelf
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                  />
                ) : isAdmin ? (
                  <BotoesAdmin
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                    onRemover={() => remover(p.jogador_id)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {ordenados.length === 0 && (
          <div className="px-3 py-3 text-xs font-mono text-giz-fraco">Nenhum convite ainda.</div>
        )}
      </div>

      {isAdmin && livres > 0 && (
        <div className="border-t border-borda">
          <button
            type="button"
            onClick={abrirAvulso}
            className="w-full min-h-[44px] flex items-center justify-center px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-destaque-texto hover:bg-superficie-2 transition cursor-pointer"
          >
            {mostrandoAvulso
              ? 'Fechar seleção'
              : `+ Adicionar Avulso (${livres} vaga${livres > 1 ? 's' : ''})`}
          </button>
          {mostrandoAvulso && (
            <div className="max-h-52 overflow-y-auto divide-y divide-borda">
              {candidatosAvulso.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={processando !== null}
                  onClick={() => adicionar(j.id)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 text-sm text-giz hover:bg-superficie-2 active:translate-y-px transition cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar username={j.username} size="xs" />
                    <span className="truncate font-medium">{j.username}</span>
                  </span>
                  <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                    {POSICOES[j.posicao]}
                  </span>
                </button>
              ))}
              {candidatosAvulso.length === 0 && (
                <div className="px-3 py-3 text-xs font-mono text-giz-fraco">
                  Nenhum jogador disponível.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {erroLocal && (
        <p className="px-3 py-2 text-xs font-mono text-perigo border-t border-borda bg-perigo/10">
          {erroLocal}
        </p>
      )}
    </section>
  );
}
