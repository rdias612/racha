// Destaque de falhas recentes (RF07): 'falha' + 'sem_clipes' das últimas 48h
// (RPC da Fase 6 com default 48). Sem falhas o bloco NÃO existe (return null) —
// é um aviso, não um painel permanente.
import { AlertTriangle } from 'lucide-react';
import { formatarDataLista } from '../lib/formatacao';
import type { ImportacaoClipes } from '../lib/clipes';

export interface SecaoFalhasRecentesClipesProps {
  falhas: ImportacaoClipes[];
  carregando: boolean;
  erro: string | null;
}

export function SecaoFalhasRecentesClipes({ falhas, carregando, erro }: SecaoFalhasRecentesClipesProps) {
  if (carregando || erro || falhas.length === 0) return null;

  return (
    <section className="rounded-[4px] border border-perigo/40 bg-perigo/10 p-3.5 shadow-carimbo space-y-2">
      <h3 className="flex items-center gap-2 font-display font-bold text-sm uppercase tracking-wider text-perigo">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Falhas nas últimas 48h ({falhas.length})
      </h3>
      <ul className="space-y-1.5">
        {falhas.map((f) => (
          <li key={f.id} className="text-xs font-mono text-giz tabular-nums">
            {formatarDataLista(f.data_referencia)} · {f.status === 'sem_clipes' ? 'sem clipes no slot' : f.erro ?? 'falha'}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-giz-fraco">
        Use o disparo manual abaixo para reexecutar o dia afetado.
      </p>
    </section>
  );
}
