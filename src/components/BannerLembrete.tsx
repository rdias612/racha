import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useJogadorLogado } from '../hooks/useJogadorLogado';

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
  const [pendentes, setPendentes] = useState<PartidaAberta[]>([]);
  const [agora, setAgora] = useState(Date.now());

  // Recarrega a cada 30s se houver pendentes, senão a cada 5min
  useEffect(() => {
    async function verificar() {
      if (!jogador) return;
      // Busca partidas published com votação aberta
      const { data } = await supabase
        .from('partidas')
        .select('id, voting_closes_at')
        .eq('status', 'published')
        .gt('voting_closes_at', new Date().toISOString());

      if (!data || data.length === 0) {
        setPendentes([]);
        return;
      }

      // Filtra as que o usuário ainda não votou (LEFT JOIN virtual: pega
      // os ids onde ele já votou e exclui)
      const { data: votados } = await supabase
        .from('votes')
        .select('partida_id')
        .eq('voter_id', jogador.id)
        .in(
          'partida_id',
          data.map((p) => p.id)
        );
      const idsVotados = new Set((votados ?? []).map((v) => v.partida_id));
      const pendentesLista = data.filter((p) => !idsVotados.has(p.id));
      setPendentes(pendentesLista);
    }
    verificar();
    const temPendentes = pendentes.length > 0;
    const intervalo = temPendentes ? 30_000 : 5 * 60_000;
    const i = setInterval(verificar, intervalo);
    return () => clearInterval(i);
  }, [jogador?.id, pendentes.length]);

  // Tick a cada 1min para atualizar o countdown
  useEffect(() => {
    if (pendentes.length === 0) return;
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [pendentes.length]);

  if (pendentes.length === 0) return null;

  return (
    <div className="border-b border-destaque/40 bg-destaque/10 px-3 py-2 sm:px-4 space-y-1">
      {pendentes.map((p) => {
        const restante = new Date(p.voting_closes_at).getTime() - agora;
        return (
          <Link
            key={p.id}
            to={`/partida/${p.id}/votar`}
            className="flex items-center justify-between text-xs hover:opacity-80 transition"
          >
            <span className="font-display font-bold uppercase tracking-wider text-giz">
              ⚡ Urna Aberta — Partida #{p.id}
            </span>
            <span className="font-mono text-[11px] font-bold text-destaque">
              fecha em {formatarRestante(restante)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
