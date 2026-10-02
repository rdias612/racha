// Grade de clipes da partida (RF04 — player nativo, sem libs novas; RNF01).
// Segue o visual de card dos componentes existentes (GridTimesPartida.tsx:29,
// Resumo.tsx:177). Carregamento/erro/vazio são responsabilidade da rota:
// o componente SÓ é renderizado com lista não vazia (PartidaDetalhe.tsx),
// então aqui não há skeleton nem estado de erro — SRP.

import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { ClipeComUrl } from '../lib/clipes';

export interface GradeClipesPartidaProps {
  clipes: ClipeComUrl[];
}

/** Formata bytes em MB (local: só a grade exibe tamanho; formatacao.ts não tem isso). */
function formatarTamanho(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GradeClipesPartida({ clipes }: GradeClipesPartidaProps) {
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-giz-fraco">
                Clipe {clipe.ordem ?? indice + 1}
                {formatarTamanho(clipe.size_bytes) && (
                  <> · {formatarTamanho(clipe.size_bytes)}</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* Baixar: âncora direta na URL pública. O atributo `download`
                    é ignorado cross-origin (bucket no supabase.co) — o browser
                    abre o vídeo numa aba nova, de onde o usuário salva;
                    o atributo fica para o dia em que a origem mudar. */}
                <a
                  href={clipe.url}
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
