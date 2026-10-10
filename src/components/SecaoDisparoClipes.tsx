// Form de disparo manual por dia específico (RF03). O estado do form é da seção;
// a AÇÃO (RPC + snackbar + recarga) é da rota — padrão SecaoNotificacaoTestes
// (NotificacoesTestes.tsx:139-146 recebe disparando/onTestarPush).

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Botao } from './ui/Botao';
import { hojeStr } from '../lib/formatacao';

export interface SecaoDisparoClipesProps {
  disparando: boolean;
  /** Envia a data escolhida; a rota confirma (ConfirmDialog) e dispara. */
  onSolicitarDisparo: (data: string) => void;
}

export function SecaoDisparoClipes({ disparando, onSolicitarDisparo }: SecaoDisparoClipesProps) {
  // Default hoje: o caso comum é recuperar a partida da semana; o admin ajusta
  // para datas históricas (D9). `max` de hoje espelha a validação da RPC.
  const [data, setData] = useState(() => hojeStr());
  const podeDisparar = Boolean(data) && !disparando;

  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
      <div>
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Disparar importação
        </h3>
        <p className="text-xs text-giz-fraco mt-0.5">
          Baixa os clipes do dia informado no Filma Eu — usando os horários reais da partida quando
          definidos — e os publica na partida correspondente. O resultado aparece no histórico
          abaixo (assíncrono).
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
          Dia da partida
        </span>
        <input
          type="date"
          value={data}
          max={hojeStr()}
          onChange={(e) => setData(e.target.value)}
          className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
        />
      </label>

      <Botao onClick={() => onSolicitarDisparo(data)} disabled={!podeDisparar} larguraCompleta>
        <Send className="size-3.5" aria-hidden="true" />
        {disparando ? 'Disparando…' : 'Disparar importação'}
      </Botao>
    </section>
  );
}
