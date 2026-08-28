import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { carregarPartidasVotadas, votacaoAberta } from '../lib/partidas';

interface PartidaAberta {
  id: number;
  voting_closes_at: string;
}

function formatarRestante(ms: number): string {
  if (ms <= 0) return 'encerrando';
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function BannerLembrete() {
  const jogador = useJogadorLogado();
  const jogadorId = jogador?.id;
  const [pendentes, setPendentes] = useState<PartidaAberta[]>([]);
  const [agora, setAgora] = useState(Date.now());

  // Geração de requisição: resposta de um polling antigo (troca de jogador
  // logado) nunca sobrescreve o estado de um polling mais novo.
  const geracaoRef = useRef(0);

  const verificar = useCallback(async () => {
    // Aba em segundo plano não gasta quota: o listener de visibilitychange
    // re-verifica assim que o usuário volta.
    if (!jogadorId || document.hidden) return;
    const geracao = ++geracaoRef.current;

    try {
      // Busca partidas published com votação aberta
      const { data, error } = await supabase
        .from('partidas')
        .select('id, status, voting_closes_at')
        .eq('status', 'published')
        .gt('voting_closes_at', new Date().toISOString());

      if (error || geracao !== geracaoRef.current) return;

      if (!data || data.length === 0) {
        setPendentes([]);
        return;
      }

      // Filtra as que o usuário ainda não votou (LEFT JOIN virtual)
      const idsVotados = await carregarPartidasVotadas(
        jogadorId,
        data.map((p) => p.id)
      );
      if (geracao !== geracaoRef.current) return;
      setPendentes(
        data.filter(
          (p): p is { id: number; voting_closes_at: string; status: string } =>
            votacaoAberta(p) && p.voting_closes_at != null && !idsVotados.has(p.id)
        )
      );
    } catch {
      // Falha de rede durante o polling: mantém o último estado conhecido.
    }
  }, [jogadorId]);

  // Busca imediata ao montar ou trocar de jogador logado.
  useEffect(() => {
    verificar();
  }, [verificar]);

  // Recarrega a cada 30s se houver pendentes, senão a cada 5min. O intervalo
  // mora num efeito próprio para não refazer a busca quando `pendentes` muda.
  useEffect(() => {
    const intervalo = pendentes.length > 0 ? 30_000 : 5 * 60_000;
    const i = setInterval(() => verificar(), intervalo);
    return () => clearInterval(i);
  }, [verificar, pendentes.length]);

  // Ao voltar para a aba, atualiza na hora (o polling foi pulado em background).
  useEffect(() => {
    function aoMudarVisibilidade() {
      if (!document.hidden) verificar();
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, [verificar]);

  // Tick a cada 1min para atualizar o countdown
  useEffect(() => {
    if (pendentes.length === 0) return;
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [pendentes.length]);

  if (pendentes.length === 0) return null;

  return (
    <div className="border-b border-destaque/40 bg-destaque/10 px-3 py-1.5 sm:px-4 space-y-1">
      {pendentes.map((p) => {
        const restante = new Date(p.voting_closes_at).getTime() - agora;
        return (
          <Link
            key={p.id}
            to={`/partida/${p.id}/votar`}
            className="flex min-h-[44px] items-center justify-between gap-2 text-xs hover:opacity-85 transition rounded-[4px] px-2 py-1 focus-visible:outline-2 focus-visible:outline-destaque-texto"
          >
            <span className="font-display font-bold uppercase tracking-wider text-giz">
              ⚡ Urna Aberta — Partida #{p.id}
            </span>
            <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
              fecha em {formatarRestante(restante)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
