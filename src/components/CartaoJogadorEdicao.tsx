import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { StepperBox } from './StepperBox';
import { POSICOES } from '../lib/times';
import type { ParticipanteEdicao } from '../lib/partidas';

export interface CartaoJogadorEdicaoProps {
  participante: ParticipanteEdicao;
  outroTimeNome: string;
  onMover: (jogadorId: number) => void;
  onSolicitarRemover: (participante: ParticipanteEdicao) => void;
  onAjustar: (
    jogadorId: number,
    campo: 'gols' | 'assistencias' | 'gols_contra',
    delta: number
  ) => void;
}

export function CartaoJogadorEdicao({
  participante: p,
  outroTimeNome,
  onMover,
  onSolicitarRemover,
  onAjustar,
}: CartaoJogadorEdicaoProps) {
  const ehGoleiro = p.posicao === 'goleiro';
  const temEstatisticas = p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0;

  return (
    <div
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
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-destaque-texto bg-destaque/10 border border-destaque/30 px-1.5 py-0.2 rounded-[2px] shrink-0">
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
            onClick={() => onMover(p.jogador_id)}
            title={`Mover para o Time ${outroTimeNome}`}
            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] border border-borda bg-superficie-2 text-[11px] font-display font-bold uppercase tracking-wider text-giz hover:text-destaque-texto active:translate-y-px transition cursor-pointer shadow-carimbo"
          >
            <ArrowLeftRight className="size-3.5 text-destaque-texto" />
            <span>{outroTimeNome}</span>
          </button>
          <button
            type="button"
            onClick={() => onSolicitarRemover(p)}
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
          onMenos={() => onAjustar(p.jogador_id, 'gols', -1)}
          onMais={() => onAjustar(p.jogador_id, 'gols', 1)}
        />
        <StepperBox
          icone="🅰️"
          label="Assists"
          valor={p.assistencias}
          corAtiva="azul"
          onMenos={() => onAjustar(p.jogador_id, 'assistencias', -1)}
          onMais={() => onAjustar(p.jogador_id, 'assistencias', 1)}
        />
        <StepperBox
          icone="🥅"
          label="GC"
          valor={p.gols_contra}
          corAtiva="perigo"
          onMenos={() => onAjustar(p.jogador_id, 'gols_contra', -1)}
          onMais={() => onAjustar(p.jogador_id, 'gols_contra', 1)}
        />
      </div>
    </div>
  );
}
