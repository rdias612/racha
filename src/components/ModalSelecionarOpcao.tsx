import { Check } from 'lucide-react';
import { vibrateLight } from '../lib/haptics';
import { ModalBase } from './ModalBase';

export interface OpcaoModal {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface ModalSelecionarOpcaoProps {
  open: boolean;
  titulo: string;
  subtitulo?: string;
  opcoes: OpcaoModal[];
  valorAtual: string;
  onSelecionar: (value: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet / modal de seleção única para substituir `<select>` nativo.
 * Alinhado à identidade visual "Súmula de Quinta" com toque mínimo de 44px,
 * haptics, fechamento por Escape e backdrop desfocado.
 */
export function ModalSelecionarOpcao({
  open,
  titulo,
  subtitulo,
  opcoes,
  valorAtual,
  onSelecionar,
  onClose,
}: ModalSelecionarOpcaoProps) {
  function handleSelecionar(value: string) {
    vibrateLight();
    onSelecionar(value);
    onClose();
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      titulo={titulo}
      subtitulo={subtitulo}
      tamanhoMaximo="md"
      posicao="bottom-sheet"
      rodape={
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition active:translate-y-px shadow-xs cursor-pointer"
        >
          Fechar
        </button>
      }
    >
      <div className="p-2 sm:p-3 space-y-1">
        {opcoes.map((opcao) => {
          const selecionado = opcao.value === valorAtual;
          return (
            <button
              key={opcao.value}
              type="button"
              disabled={opcao.disabled}
              onClick={() => handleSelecionar(opcao.value)}
              className={`w-full min-h-[48px] px-3 py-2.5 rounded-[4px] flex items-center justify-between gap-3 text-left transition border active:translate-y-px ${
                selecionado
                  ? 'border-destaque bg-destaque/15 shadow-xs'
                  : opcao.disabled
                    ? 'border-transparent opacity-40 cursor-not-allowed bg-superficie-2/30'
                    : 'border-transparent bg-superficie hover:bg-superficie-2 hover:border-borda cursor-pointer'
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
                  Selecionado
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
