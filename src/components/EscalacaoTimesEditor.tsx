import { type ReactNode, useMemo } from 'react';
import { Wand2 } from 'lucide-react';
import { type JogadorLista } from '../lib/jogadores';
import { type TimeId } from '../lib/times';
import { MensagemEstado } from './Estado';

export const LIMITE_POR_TIME = 7;

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
}: EscalacaoTimesEditorProps) {
  const contagemTime = useMemo(() => {
    const c: Record<TimeId, number> = { a: 0, b: 0 };
    for (const t of Object.values(times)) {
      if (t) c[t]++;
    }
    return c;
  }, [times]);

  const temSelecaoGoleiros = Boolean(onSelecionarGoleiroA && onSelecionarGoleiroB);

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

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <button
        type="button"
        onClick={onVoltar}
        className="text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        ← voltar
      </button>

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
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[3px] border border-destaque bg-destaque/15 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-destaque shadow-xs hover:bg-destaque hover:text-destaque-tinta transition active:translate-y-px disabled:opacity-40"
        >
          <Wand2 className="size-3.5" />
          <span>Equilibrar</span>
        </button>
      </div>

      {/* Painel com os 2 times, contadores e Seleção de Goleiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const count = contagemTime[t];
          const ehPreto = t === 'a';
          const goleiroId = ehPreto ? goleiroA : goleiroB;
          const setGoleiro = ehPreto ? onSelecionarGoleiroA : onSelecionarGoleiroB;
          const outroGoleiroId = ehPreto ? goleiroB : goleiroA;
          const temGoleiro = goleiroId !== null && goleiroId !== undefined;
          const completo = count === LIMITE_POR_TIME && (!temSelecaoGoleiros || temGoleiro);

          return (
            <div
              key={t}
              className={`rounded-[4px] border-2 p-3 text-center shadow-carimbo transition flex flex-col justify-between ${
                completo ? 'border-ok/70 bg-superficie' : 'border-borda bg-superficie'
              }`}
            >
              <div>
                <div
                  className="inline-block px-2.5 py-0.5 rounded-[2px] font-display font-black text-xs uppercase tracking-widest border mb-1.5 shadow-xs"
                  style={{
                    backgroundColor: ehPreto ? '#0d0d0e' : '#f4f1e8',
                    color: ehPreto ? '#f4f1e8' : '#0d0d0e',
                    borderColor: '#35302a',
                  }}
                >
                  Time {ehPreto ? 'Preto' : 'Branco'}
                </div>
                <div className="font-mono text-xl font-bold text-destaque tabular-nums">
                  {count}/{LIMITE_POR_TIME} de linha
                </div>
              </div>

              {/* Seletor de Goleiro dedicado */}
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
                        className="text-xs font-mono text-destaque hover:underline min-h-[32px] px-1 inline-flex items-center"
                      >
                        + Novo
                      </button>
                    )}
                  </div>

                  <select
                    value={goleiroId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setGoleiro?.(val);
                    }}
                    className={`w-full rounded-[4px] border bg-superficie-2 px-3 py-2 text-base sm:text-xs font-mono text-giz focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 min-h-[44px] ${
                      temGoleiro ? 'border-ok/60 text-ok font-bold' : 'border-borda text-giz-fraco'
                    }`}
                  >
                    <option value="">-- Selecionar Goleiro --</option>
                    {goleirosDisponiveis.map((g) => {
                      const ocupadoNoOutroTime = g.id === outroGoleiroId;
                      const ocupadoNaLinha = Boolean(times[g.id]);
                      const disabled = ocupadoNoOutroTime || ocupadoNaLinha;
                      const labelExtra = ocupadoNoOutroTime
                        ? ` (No time ${ehPreto ? 'Branco' : 'Preto'})`
                        : ocupadoNaLinha
                          ? ' (Escalado na linha)'
                          : '';

                      return (
                        <option key={g.id} value={g.id} disabled={disabled}>
                          @{g.username} {labelExtra}
                        </option>
                      );
                    })}
                  </select>
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
                    className="shrink-0 text-xs font-mono font-bold text-destaque"
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
                        ? 'bg-[#0d0d0e] text-[#f4f1e8] border-destaque shadow-xs'
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
                        ? 'bg-[#f4f1e8] text-[#0d0d0e] border-destaque shadow-xs'
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

      <div
        className="fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={onSalvar}
            disabled={!podeSalvar}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-40"
          >
            {salvando ? salvandoRotulo : salvarRotulo}
          </button>
          {!podeSalvar && (
            <p className="mt-1 text-center text-xs font-mono text-giz-fraco">
              {contagemTime.a !== LIMITE_POR_TIME || contagemTime.b !== LIMITE_POR_TIME
                ? `Aloque exatamente ${LIMITE_POR_TIME} jogadores de linha em cada time.`
                : temSelecaoGoleiros && (goleiroA === null || goleiroB === null)
                  ? 'Selecione o goleiro de cada time.'
                  : temSelecaoGoleiros && goleiroA === goleiroB
                    ? 'Selecione goleiros diferentes para cada time.'
                    : !goleiroAValido || !goleiroBValido
                      ? 'Um jogador escalado na linha não pode ser o goleiro.'
                      : 'Verifique a escalação dos times.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
