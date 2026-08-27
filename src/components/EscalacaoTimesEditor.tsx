import { type ReactNode, useMemo, useState } from 'react';
import { Copy, Wand2 } from 'lucide-react';
import { type JogadorLista } from '../lib/jogadores';
import { POSICOES, type PosicaoId, type TimeId } from '../lib/times';
import { useSnackbar } from '../hooks/useSnackbar';
import { Snackbar } from './Snackbar';
import { MensagemEstado } from './Estado';
import { ModalSelecionarGoleiro } from './ModalSelecionarGoleiro';
import { BotaoVoltar } from './BotaoVoltar';
import { BarraAcaoInferior } from './BarraAcaoInferior';
import { BadgeTime } from './BadgeTime';

export const LIMITE_POR_TIME = 7;

/** Ordem de exibição das posições no texto copiado para o WhatsApp. */
const ORDEM_POSICOES_TEXTO: PosicaoId[] = [
  'goleiro',
  'zagueiro',
  'lateral',
  'meia',
  'atacante',
  'random',
];

/**
 * Ordena os jogadores de um time pela ordem do texto copiado:
 * posição (ORDEM_POSICOES_TEXTO) e, dentro dela, ordem alfabética.
 */
function ordenarPorPosicaoTexto(jogadores: JogadorLista[]): JogadorLista[] {
  return [...jogadores].sort((x, y) => {
    const px = ORDEM_POSICOES_TEXTO.indexOf(x.posicao);
    const py = ORDEM_POSICOES_TEXTO.indexOf(y.posicao);
    if (px !== py) return px - py;
    return x.username.localeCompare(y.username);
  });
}

/**
 * Monta o texto das escalações para colar no WhatsApp (Branco primeiro):
 *
 * Time BRANCO (media 6.5)
 * Goleiro nome      (apenas quando já escolhido)
 * Zagueiro nome
 * ...
 *
 * Time PRETO (media 6.4)
 * ...
 *
 * A média considera apenas os jogadores de linha do time (padrão 6.0 sem nota),
 * mesmo critério do feedback do sorteio automático.
 */
function montarTextoEscalacao(params: {
  jogadores: JogadorLista[];
  times: Record<number, TimeId>;
  mediasNotas: Record<number, number>;
  goleirosPorTime: Partial<Record<TimeId, string | undefined>>;
}): string {
  const blocos = (['b', 'a'] as TimeId[]).map((t) => {
    const doTime = ordenarPorPosicaoTexto(params.jogadores.filter((j) => params.times[j.id] === t));

    let cabecalho = `Time ${t === 'a' ? 'PRETO' : 'BRANCO'}`;
    if (doTime.length > 0) {
      const media =
        doTime.reduce((s, j) => s + (params.mediasNotas[j.id] ?? 6.0), 0) / doTime.length;
      cabecalho += ` (media ${media.toFixed(1)})`;
    }
    const linhas: string[] = [cabecalho];

    const nomeGoleiro = params.goleirosPorTime[t];
    if (nomeGoleiro) linhas.push(`${POSICOES.goleiro} ${nomeGoleiro}`);

    for (const j of doTime) linhas.push(`${POSICOES[j.posicao]} ${j.username}`);

    return linhas.join('\n');
  });
  return blocos.join('\n\n');
}

/** Linha da pré-visualização lado a lado: posição + nome (igual ao texto copiado). */
function LinhaEscalacao({ posicao, nome }: { posicao: PosicaoId; nome: string | null }) {
  return (
    <div className="flex items-baseline gap-1.5 px-2 py-1.5">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-giz-fraco">
        {POSICOES[posicao]}
      </span>
      {nome ? (
        <span className="min-w-0 truncate font-display text-sm font-bold uppercase tracking-wide text-giz">
          {nome}
        </span>
      ) : (
        <span className="font-mono text-xs text-giz-fraco">—</span>
      )}
    </div>
  );
}

export interface EscalacaoTimesEditorProps {
  titulo: string;
  subtitulo?: ReactNode;
  infoExtra?: ReactNode;
  rotuloListaJogadores?: string;
  salvarRotulo?: string;
  salvandoRotulo?: string;
  onVoltar: () => void;
  jogadores: JogadorLista[];
  times: Record<number, TimeId>;
  mediasNotas: Record<number, number>;
  onAtribuirTime: (id: number, time: TimeId) => void;
  onAutoEscalar: () => void;
  onSalvar: () => void;
  salvando: boolean;
  erro?: string | null;
  feedback?: string | null;
  // Gestão de Goleiros
  goleirosDisponiveis?: JogadorLista[];
  goleiroA?: number | null;
  goleiroB?: number | null;
  onSelecionarGoleiroA?: (id: number | null) => void;
  onSelecionarGoleiroB?: (id: number | null) => void;
  onAbrirModalNovoGoleiro?: (time: TimeId) => void;
  /** Exibe botão secundário para copiar as escalações (colar no WhatsApp). */
  mostrarCopiarEscalacao?: boolean;
}

export function EscalacaoTimesEditor({
  titulo,
  subtitulo,
  infoExtra,
  rotuloListaJogadores = 'Jogadores',
  salvarRotulo = 'Salvar times',
  salvandoRotulo = 'Salvando…',
  onVoltar,
  jogadores,
  times,
  mediasNotas,
  onAtribuirTime,
  onAutoEscalar,
  onSalvar,
  salvando,
  erro,
  feedback,
  goleirosDisponiveis = [],
  goleiroA = null,
  goleiroB = null,
  onSelecionarGoleiroA,
  onSelecionarGoleiroB,
  onAbrirModalNovoGoleiro,
  mostrarCopiarEscalacao = false,
}: EscalacaoTimesEditorProps) {
  const [modalGoleiroTime, setModalGoleiroTime] = useState<TimeId | null>(null);
  const { mostrarSucesso, mostrarErro, snackbarProps } = useSnackbar();

  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const t of Object.values(times)) {
      if (t) c[t]++;
    }
    return c;
  }, [times]);

  const temSelecaoGoleiros = Boolean(onSelecionarGoleiroA && onSelecionarGoleiroB);

  const nomeGoleiroA = goleirosDisponiveis.find((g) => g.id === goleiroA)?.username;
  const nomeGoleiroB = goleirosDisponiveis.find((g) => g.id === goleiroB)?.username;

  /** Colunas da pré-visualização lado a lado (Branco | Preto), na ordem do copiar. */
  const colunasEscalacao = useMemo(() => {
    const goleirosPorTime: Partial<Record<TimeId, string | undefined>> = {
      a: nomeGoleiroA,
      b: nomeGoleiroB,
    };
    return (['b', 'a'] as TimeId[]).map((t) => {
      const doTime = ordenarPorPosicaoTexto(jogadores.filter((j) => times[j.id] === t));
      const media =
        doTime.length > 0
          ? doTime.reduce((s, j) => s + (mediasNotas[j.id] ?? 6.0), 0) / doTime.length
          : null;
      return {
        time: t,
        jogadores: doTime,
        nomeGoleiro: goleirosPorTime[t],
        media,
        vazia: !temSelecaoGoleiros && doTime.length === 0,
      };
    });
  }, [jogadores, times, mediasNotas, nomeGoleiroA, nomeGoleiroB, temSelecaoGoleiros]);

  const goleiroAValido = !temSelecaoGoleiros || (goleiroA !== null && !times[goleiroA]);
  const goleiroBValido = !temSelecaoGoleiros || (goleiroB !== null && !times[goleiroB]);
  const goleirosDistintos =
    !temSelecaoGoleiros || (goleiroA !== null && goleiroB !== null && goleiroA !== goleiroB);

  const podeSalvar =
    contagemTime.a === LIMITE_POR_TIME &&
    contagemTime.b === LIMITE_POR_TIME &&
    goleiroAValido &&
    goleiroBValido &&
    goleirosDistintos &&
    !salvando;

  const totalConfirmados = jogadores.length;

  function handleCopiarEscalacao() {
    const algumEscalado =
      jogadores.some((j) => times[j.id]) || goleiroA !== null || goleiroB !== null;
    if (!algumEscalado) {
      mostrarErro('Escale os times antes de copiar.');
      return;
    }

    const texto = montarTextoEscalacao({
      jogadores,
      times,
      mediasNotas,
      goleirosPorTime: { a: nomeGoleiroA, b: nomeGoleiroB },
    });

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      mostrarErro('Não foi possível copiar as escalações.');
      return;
    }
    navigator.clipboard
      .writeText(texto)
      .then(() => mostrarSucesso('Escalações copiadas!'))
      .catch(() => mostrarErro('Não foi possível copiar as escalações.'));
  }

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar onClick={onVoltar} />

      {/* Cabeçalho */}
      <div className="sumula-header pb-2">
        <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
          {titulo}
        </h2>
        {subtitulo}
      </div>

      {infoExtra}

      {/* Card da Ferramenta de Sorteio Equilibrado */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
            Escalação Automática
          </h3>
          <p className="text-[11px] font-mono text-giz-fraco mt-0.5">
            Equilibra os 14 de linha por posição e notas ({totalConfirmados}/{LIMITE_POR_TIME * 2}{' '}
            confirmados)
          </p>
        </div>
        <button
          type="button"
          onClick={onAutoEscalar}
          disabled={totalConfirmados < LIMITE_POR_TIME * 2}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[3px] border border-destaque bg-destaque/15 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-destaque-texto shadow-xs hover:bg-destaque hover:text-destaque-tinta transition active:translate-y-px disabled:opacity-40"
        >
          <Wand2 className="size-3.5" />
          <span>Equilibrar</span>
        </button>
      </div>

      {/* Pré-visualização da escalação lado a lado (ordem idêntica ao "Copiar escalações") */}
      <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
        <div className="px-3 py-2 bg-superficie-2 border-b border-borda flex items-center justify-between">
          <span className="font-display font-bold text-xs uppercase tracking-wider text-giz">
            Escalação Lado a Lado
          </span>
        </div>
        <div className="grid grid-cols-2">
          {colunasEscalacao.map((col, idx) => (
            <div key={col.time} className={idx === 0 ? 'border-r border-borda' : ''}>
              <div className="px-2 py-2 border-b border-borda flex items-center justify-between gap-1">
                <BadgeTime time={col.time} tamanho="xs" />
                {col.media !== null && (
                  <span
                    className="font-mono text-[10px] font-bold text-destaque-texto tabular-nums"
                    title="Média de notas dos jogadores de linha"
                  >
                    {col.media.toFixed(1)}★
                  </span>
                )}
              </div>
              <div className="divide-y divide-borda/40">
                {temSelecaoGoleiros && (
                  <LinhaEscalacao posicao="goleiro" nome={col.nomeGoleiro ?? null} />
                )}
                {col.jogadores.map((j) => (
                  <LinhaEscalacao key={j.id} posicao={j.posicao} nome={j.username} />
                ))}
                {col.vazia && (
                  <p className="px-2 py-2 text-center font-mono text-[10px] text-giz-fraco">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel com os 2 times, contadores e Seleção de Goleiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const count = contagemTime[t];
          const ehPreto = t === 'a';
          const goleiroId = ehPreto ? goleiroA : goleiroB;
          const temGoleiro = goleiroId !== null && goleiroId !== undefined;
          const goleiroObj = goleirosDisponiveis.find((g) => g.id === goleiroId);
          const nomeGoleiro = goleiroObj?.username;
          const completo = count === LIMITE_POR_TIME && (!temSelecaoGoleiros || temGoleiro);

          return (
            <div
              key={t}
              className={`rounded-[4px] border-2 p-3 text-center shadow-carimbo transition flex flex-col justify-between ${
                completo ? 'border-ok/70 bg-superficie' : 'border-borda bg-superficie'
              }`}
            >
              <div>
                <BadgeTime time={t} className="mb-1.5" />
                <div className="font-mono text-xl font-bold text-destaque-texto tabular-nums">
                  {count}/{LIMITE_POR_TIME} de linha
                </div>
              </div>

              {/* Seletor de Goleiro dedicado com Modal */}
              {temSelecaoGoleiros && (
                <div className="mt-3 pt-2.5 border-t border-borda text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-display font-bold uppercase tracking-wider text-giz flex items-center gap-1">
                      🧤 Goleiro {ehPreto ? 'Preto' : 'Branco'}
                    </span>
                    {onAbrirModalNovoGoleiro && (
                      <button
                        type="button"
                        onClick={() => onAbrirModalNovoGoleiro(t)}
                        className="text-xs font-mono text-destaque-texto hover:underline min-h-[44px] px-1 inline-flex items-center"
                      >
                        + Novo
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalGoleiroTime(t)}
                    aria-label={`Selecionar goleiro do time ${ehPreto ? 'Preto' : 'Branco'}`}
                    className={`w-full rounded-[4px] border px-3 py-2 text-left font-mono transition flex items-center justify-between gap-2 min-h-[44px] shadow-xs active:translate-y-px ${
                      temGoleiro
                        ? 'border-ok/60 bg-superficie-2 text-ok font-bold hover:border-ok'
                        : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">🧤</span>
                      <span className="truncate text-base sm:text-xs">
                        {nomeGoleiro ? nomeGoleiro : '-- Toque para escolher --'}
                      </span>
                    </div>
                    <span className="text-[11px] font-display font-bold uppercase tracking-wider text-destaque-texto shrink-0">
                      {temGoleiro ? 'Trocar' : 'Escolher'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista dos confirmados com botões Preto/Branco */}
      <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
        <div className="px-3 py-2 bg-superficie-2 border-b border-borda flex items-center justify-between">
          <span className="font-display font-bold text-xs uppercase tracking-wider text-giz">
            {rotuloListaJogadores} ({jogadores.length})
          </span>
          <span className="text-[10px] font-mono text-giz-fraco">Toque para escalar</span>
        </div>
        <div className="divide-y divide-borda">
          {jogadores.map((j) => {
            const time = times[j.id] ?? null;
            const neutro = time === null;
            const pretoCheio = contagemTime.a >= LIMITE_POR_TIME && time !== 'a';
            const brancoCheio = contagemTime.b >= LIMITE_POR_TIME && time !== 'b';
            const pretoDisabled = pretoCheio;
            const brancoDisabled = brancoCheio;
            const ehGoleiro = j.posicao === 'goleiro' || j.posicao_b === 'goleiro';
            const temNota = mediasNotas[j.id] !== undefined;
            const notaJogador = temNota ? mediasNotas[j.id] : 6.0;

            return (
              <div
                key={j.id}
                className={`flex items-center gap-2 px-3 py-2.5 transition ${
                  neutro ? 'bg-superficie opacity-75' : 'bg-superficie-2'
                }`}
              >
                <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-bold text-giz">{j.username}</span>
                  {ehGoleiro && (
                    <span className="shrink-0 text-xs font-mono" title="Goleiro">
                      🧤
                    </span>
                  )}
                  <span
                    className="shrink-0 text-xs font-mono font-bold text-destaque-texto"
                    title={`Média: ${notaJogador.toFixed(1)}★`}
                  >
                    {notaJogador.toFixed(1)}★
                  </span>
                </div>
                <div className="shrink-0 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAtribuirTime(j.id, 'a')}
                    disabled={pretoDisabled}
                    aria-pressed={time === 'a'}
                    aria-label={`Escalar ${j.username} no time Preto`}
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-[3px] border font-display font-bold uppercase tracking-wider text-xs transition active:translate-y-px disabled:opacity-30 ${
                      time === 'a'
                        ? 'bg-preto-time text-branco-time border-destaque shadow-xs'
                        : 'border-borda bg-superficie text-giz-fraco hover:text-giz'
                    }`}
                  >
                    Preto
                  </button>
                  <button
                    type="button"
                    onClick={() => onAtribuirTime(j.id, 'b')}
                    disabled={brancoDisabled}
                    aria-pressed={time === 'b'}
                    aria-label={`Escalar ${j.username} no time Branco`}
                    className={`min-h-[44px] min-w-[3.5rem] px-2 rounded-[3px] border font-display font-bold uppercase tracking-wider text-xs transition active:translate-y-px disabled:opacity-30 ${
                      time === 'b'
                        ? 'bg-branco-time text-preto-time border-destaque shadow-xs'
                        : 'border-borda bg-superficie text-giz-fraco hover:text-giz'
                    }`}
                  >
                    Branco
                  </button>
                </div>
              </div>
            );
          })}
          {jogadores.length === 0 && (
            <div className="px-3 py-3 text-xs font-mono text-giz-fraco text-center">
              Nenhum jogador na lista.
            </div>
          )}
        </div>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      <BarraAcaoInferior
        legenda={
          !podeSalvar
            ? contagemTime.a !== LIMITE_POR_TIME || contagemTime.b !== LIMITE_POR_TIME
              ? `Aloque exatamente ${LIMITE_POR_TIME} jogadores de linha em cada time.`
              : temSelecaoGoleiros && (goleiroA === null || goleiroB === null)
                ? 'Selecione o goleiro de cada time.'
                : temSelecaoGoleiros && goleiroA === goleiroB
                  ? 'Selecione goleiros diferentes para cada time.'
                  : !goleiroAValido || !goleiroBValido
                    ? 'Um jogador escalado na linha não pode ser o goleiro.'
                    : 'Verifique a escalação dos times.'
            : undefined
        }
      >
        {mostrarCopiarEscalacao && (
          <button
            type="button"
            onClick={handleCopiarEscalacao}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque/15 px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-texto shadow-xs hover:bg-destaque/25 active:translate-y-px transition inline-flex items-center justify-center gap-1.5"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span>Copiar escalações</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSalvar}
          disabled={!podeSalvar}
          className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-40"
        >
          {salvando ? salvandoRotulo : salvarRotulo}
        </button>
      </BarraAcaoInferior>

      {mostrarCopiarEscalacao && <Snackbar {...snackbarProps} />}

      {temSelecaoGoleiros && modalGoleiroTime && (
        <ModalSelecionarGoleiro
          open={Boolean(modalGoleiroTime)}
          time={modalGoleiroTime}
          goleiroAtualId={modalGoleiroTime === 'a' ? goleiroA : goleiroB}
          outroGoleiroId={modalGoleiroTime === 'a' ? goleiroB : goleiroA}
          goleirosDisponiveis={goleirosDisponiveis}
          jogadoresNaLinha={times}
          onSelecionar={(novoId) => {
            if (modalGoleiroTime === 'a') {
              onSelecionarGoleiroA?.(novoId);
            } else {
              onSelecionarGoleiroB?.(novoId);
            }
          }}
          onClose={() => setModalGoleiroTime(null)}
          onAbrirNovoGoleiro={
            onAbrirModalNovoGoleiro
              ? () => {
                  const t = modalGoleiroTime;
                  setModalGoleiroTime(null);
                  onAbrirModalNovoGoleiro(t);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
