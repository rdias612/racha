import { useState, useEffect } from 'react';
import { Check, Clock, Calendar } from 'lucide-react';
import { vibrateLight } from '../lib/haptics';
import { ModalBase } from './ModalBase';

export interface OpcaoAgendamento {
  value: string;
  label: string;
  sublabel?: string;
}

export interface ModalSelecionarAgendamentoProps {
  open: boolean;
  titulo: string;
  subtitulo?: string;
  /** Opções de dia da semana. */
  opcoesDia: OpcaoAgendamento[];
  diaAtual: string;
  /** Horário atual no formato "HH:MM". */
  horarioAtual: string;
  onConfirmar: (dia: string, horario: string) => void;
  onClose: () => void;
}

const HORAS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTOS_OPCOES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function ModalSelecionarAgendamento({
  open,
  titulo,
  subtitulo,
  opcoesDia,
  diaAtual,
  horarioAtual,
  onConfirmar,
  onClose,
}: ModalSelecionarAgendamentoProps) {
  const [diaSelecionado, setDiaSelecionado] = useState(diaAtual);
  const [hora, setHora] = useState(() => horarioAtual.slice(0, 2));
  const [minuto, setMinuto] = useState(() => horarioAtual.slice(3, 5));

  useEffect(() => {
    if (!open) return;
    setDiaSelecionado(diaAtual);
    setHora(horarioAtual.slice(0, 2));
    setMinuto(horarioAtual.slice(3, 5));
  }, [open, diaAtual, horarioAtual]);

  function handleConfirmar() {
    vibrateLight();
    const h = hora.padStart(2, '0');
    const m = minuto.padStart(2, '0');
    onConfirmar(diaSelecionado, `${h}:${m}`);
    onClose();
  }

  const horarioFormatado = `${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
  const diaLabel = opcoesDia.find((o) => o.value === diaSelecionado)?.label ?? diaSelecionado;

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      titulo={titulo}
      subtitulo={subtitulo}
      tamanhoMaximo="md"
      posicao="bottom-sheet"
      rodape={
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleConfirmar}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px"
          >
            Confirmar Agendamento
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition active:translate-y-px shadow-xs"
          >
            Cancelar
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        {/* Seleção de Dia */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-destaque-texto" />
            <span className="text-xs font-display font-bold uppercase tracking-wider text-giz">
              Dia da Semana
            </span>
          </div>
          <div className="space-y-1.5">
            {opcoesDia.map((opcao) => {
              const selecionado = opcao.value === diaSelecionado;
              return (
                <button
                  key={opcao.value}
                  type="button"
                  onClick={() => {
                    vibrateLight();
                    setDiaSelecionado(opcao.value);
                  }}
                  className={`w-full min-h-[48px] px-3 py-2.5 rounded-[4px] flex items-center justify-between gap-3 text-left transition border active:translate-y-px ${
                    selecionado
                      ? 'border-destaque bg-destaque/15 shadow-xs'
                      : 'border-borda bg-superficie-2 hover:bg-superficie hover:border-giz-fraco/30'
                  }`}
                >
                  <div className="min-w-0">
                    <span
                      className={`font-display text-sm uppercase tracking-wider ${
                        selecionado ? 'font-bold text-destaque-texto' : 'font-bold text-giz'
                      }`}
                    >
                      {opcao.label}
                    </span>
                    {opcao.sublabel && (
                      <span className="block text-[10px] font-mono text-giz-fraco mt-0.5">
                        {opcao.sublabel}
                      </span>
                    )}
                  </div>
                  {selecionado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-destaque/20 border border-destaque text-destaque-texto text-[11px] font-mono font-bold shrink-0">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seleção de Horário */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-destaque-texto" />
            <span className="text-xs font-display font-bold uppercase tracking-wider text-giz">
              Horário (BRT)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Hora */}
            <div className="space-y-1">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-giz-fraco">
                Hora
              </span>
              <div className="max-h-40 overflow-y-auto rounded-[4px] border border-borda bg-superficie-2 p-1 scrollbar-sumula">
                {HORAS.map((h) => {
                  const sel = h === hora;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        vibrateLight();
                        setHora(h);
                      }}
                      className={`w-full min-h-[44px] px-2 py-1.5 rounded-[3px] text-center font-mono text-sm tabular-nums transition ${
                        sel
                          ? 'bg-destaque/20 text-destaque-texto font-bold border border-destaque'
                          : 'text-giz hover:bg-superficie border border-transparent'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minuto */}
            <div className="space-y-1">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-giz-fraco">
                Minuto
              </span>
              <div className="max-h-40 overflow-y-auto rounded-[4px] border border-borda bg-superficie-2 p-1 scrollbar-sumula">
                {MINUTOS_OPCOES.map((m) => {
                  const sel = m === minuto;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        vibrateLight();
                        setMinuto(m);
                      }}
                      className={`w-full min-h-[44px] px-2 py-1.5 rounded-[3px] text-center font-mono text-sm tabular-nums transition ${
                        sel
                          ? 'bg-destaque/20 text-destaque-texto font-bold border border-destaque'
                          : 'text-giz hover:bg-superficie border border-transparent'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-[4px] border border-borda bg-superficie-2 p-3 text-center shadow-xs">
          <span className="text-[10px] font-display uppercase tracking-widest text-giz-fraco">
            Resumo do Agendamento
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-destaque-texto tabular-nums">
            {diaLabel} · {horarioFormatado}
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
