// Grade de clipes da partida (RF04 — player nativo, sem libs novas; RNF01).
// Segue o visual de card dos componentes existentes (GridTimesPartida.tsx:29,
// Resumo.tsx:177). Carregamento/erro/vazio são responsabilidade da rota:
// o componente SÓ é renderizado com lista não vazia (PartidaDetalhe.tsx),
// então aqui não há skeleton nem estado de erro — SRP. O modo de seleção
// (checkbox por card) é OPCIONAL via props: sem elas o DOM é o de leitura
// puro (PartidaDetalhe); com elas, o Repositório admin (Plano 36, Passo 3)
// marca clipes para exclusão em lote.

import { useState } from 'react';
import { Download, Share2, Trash2 } from 'lucide-react';
import { formatarTamanhoBytes } from '../lib/formatacao';
import type { ClipeComUrl } from '../lib/clipes';

export interface GradeClipesPartidaProps {
  clipes: ClipeComUrl[];
  /** Modo seleção (opcional): ids marcados. Só faz sentido com onToggleSelecao. */
  selecionadoIds?: ReadonlySet<number>;
  /** Modo seleção (opcional): toggle por card. Ausente = grade só de leitura. */
  onToggleSelecao?: (clipeId: number) => void;
  /** Congela os checkboxes durante a exclusão (evita toggle com request em voo). */
  desabilitarSelecao?: boolean;
  /** Modo admin (opcional): exclusão individual. Ausente = grade só de leitura. */
  onExcluirClipe?: (clipeId: number) => void;
  /** Congela o botão de excluir durante a exclusão (request em voo). */
  desabilitarExclusao?: boolean;
}

export function GradeClipesPartida({
  clipes,
  selecionadoIds,
  onToggleSelecao,
  desabilitarSelecao = false,
  onExcluirClipe,
  desabilitarExclusao = false,
}: GradeClipesPartidaProps) {
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  // RF04 "compartilhar": Web Share API quando existir (mobile/PWA — o alvo é o
  // aparelho); fallback = copiar o link (clipboard), com feedback inline de 2 s.
  async function compartilhar(clipe: ClipeComUrl) {
    // typeof (e não `'share' in navigator`): o lib.dom do TS já declara `share`
    // obrigatório, e o operador `in` estreitaria o else para `never`.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Clipe da partida', url: clipe.url });
        return;
      } catch {
        // Usuário cancelou o share sheet → cai no mesmo fluxo de quem não compartilhou.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(clipe.url);
      setCopiadoId(clipe.id);
      setTimeout(() => setCopiadoId((atual) => (atual === clipe.id ? null : atual)), 2000);
    } catch {
      // Clipboard negado (permissão/http): silencioso — o link também está na
      // barra de endereço se o usuário abrir o vídeo.
    }
  }

  return (
    <section className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
      {/* Cabeçalho da seção, padrão CabecalhoTime/GridTimesPartida */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-borda bg-superficie-2">
        <h2 className="font-display font-black text-[10px] uppercase tracking-widest text-giz-fraco">
          🎥 Clipes da partida
        </h2>
        <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
          {clipes.length} {clipes.length === 1 ? 'clipe' : 'clipes'}
        </span>
      </div>

      <div className="divide-y divide-borda">
        {clipes.map((clipe, indice) => (
          <div key={clipe.id} className="p-3 space-y-2">
            {/* Player nativo do browser (RF04). preload="metadata" evita baixar
                todos os vídeos de uma vez; playsInline para iOS não abrir fullscreen. */}
            <video
              controls
              playsInline
              preload="metadata"
              src={clipe.url}
              className="w-full aspect-video bg-black rounded-[2px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Checkbox do modo seleção: presente SOMENTE com onToggleSelecao —
                  sem a prop o par span/botões fica exatamente como hoje. O label
                  44x44 dá alvo de toque e não sobrepõe o player. */}
              {onToggleSelecao && (
                <label className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selecionadoIds?.has(clipe.id) ?? false}
                    disabled={desabilitarSelecao}
                    onChange={() => onToggleSelecao(clipe.id)}
                    aria-label={`Selecionar clipe ${clipe.ordem ?? indice + 1}`}
                    className="size-4 cursor-pointer rounded-[2px] accent-destaque disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
              )}
              <span
                className={
                  onToggleSelecao
                    ? 'font-mono text-[11px] text-giz-fraco min-w-0 flex-1'
                    : 'font-mono text-[11px] text-giz-fraco'
                }
              >
                Clipe {clipe.ordem ?? indice + 1}
                {formatarTamanhoBytes(clipe.size_bytes) && (
                  <> · {formatarTamanhoBytes(clipe.size_bytes)}</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* Baixar: ?download= faz o Storage responder Content-Disposition:
                    attachment e o browser baixa sem abrir aba (o atributo
                    `download` sozinho é ignorado cross-origin — bucket no
                    supabase.co; fica para o dia em que a origem mudar). */}
                <a
                  href={clipe.urlDownload}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie transition active:translate-y-px"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => compartilhar(clipe)}
                  className="flex items-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie transition active:translate-y-px"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  {copiadoId === clipe.id ? 'Copiado!' : 'Compartilhar'}
                </button>
                {/* Exclusão individual (só no modo admin): ícone-only porque
                    Baixar + Compartilhar + Excluir com texto não cabem nos
                    ~336px úteis de um mobile 360px; cores = variante perigo
                    de ui/Botao.tsx. */}
                {onExcluirClipe && (
                  <button
                    type="button"
                    onClick={() => onExcluirClipe(clipe.id)}
                    disabled={desabilitarExclusao}
                    aria-label={`Excluir clipe ${clipe.ordem ?? indice + 1}`}
                    title={`Excluir clipe ${clipe.ordem ?? indice + 1}`}
                    className="flex min-h-[44px] shrink-0 items-center justify-center rounded-[4px] border border-perigo bg-perigo px-3 text-branco-time transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
