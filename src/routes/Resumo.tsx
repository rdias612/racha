import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MensagemEstado } from '../components/Estado';
import { SkeletonResumo } from '../components/Skeletons';
import { BotaoInstalar } from '../components/BotaoInstalar';
import { CardNotificacoes } from '../components/CardNotificacoes';
import { PullToRefresh } from '../components/PullToRefresh';
import { supabase } from '../lib/supabase';
import { carregarParticipantes, vagasOcupadas, CAPACIDADE_PARTIDA } from '../lib/partidas';
import { formatarDataCompleta, formatarDataMobile } from '../lib/formatacao';
import { formatarMensagemErro } from '../lib/erros';

interface ResumoAno {
  ano: number;
  total_partidas: number;
  artilheiro_jogador_id: number | null;
  artilheiro_nome: string | null;
  artilheiro_gols: number | null;
  artilheiro_partidas: number | null;
  maestro_jogador_id: number | null;
  maestro_nome: string | null;
  maestro_assistencias: number | null;
  maestro_partidas: number | null;
  participante_jogador_id: number | null;
  participante_nome: string | null;
  participante_partidas: number | null;
  eficiente_jogador_id: number | null;
  eficiente_nome: string | null;
  eficiente_vitorias: number | null;
  eficiente_partidas: number | null;
  eficiente_percentual: number | null;
  sequencia_vitorias_jogador_id: number | null;
  sequencia_vitorias_nome: string | null;
  sequencia_vitorias: number | null;
  seca_vitorias_jogador_id: number | null;
  seca_vitorias_nome: string | null;
  seca_vitorias: number | null;
}

interface DestaqueProps {
  titulo: string;
  badge?: string;
  nome: string | null;
  valor: string;
  detalhe?: string;
}

export function Resumo() {
  const ano = new Date().getFullYear();
  const [resumo, setResumo] = useState<ResumoAno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [proxima, setProxima] = useState<{
    id: number;
    data_jogo: string;
    ocupadas: number;
  } | null>(null);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      setCarregando(true);
      setErro(null);
      try {
        const [respResumo, respProx] = await Promise.all([
          supabase.rpc('resumo_ano', { p_ano: ano }),
          supabase
            .from('partidas')
            .select('id, data_jogo, confirmacao_closes_at')
            .eq('status', 'draft')
            .order('data_jogo', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (isAtivo && !isAtivo()) return;

        if (respResumo.error) {
          setErro(formatarMensagemErro(respResumo.error));
        } else {
          setResumo(respResumo.data?.[0] ?? null);
        }

        if (respProx.data) {
          const parts = await carregarParticipantes(respProx.data.id);
          if (isAtivo && !isAtivo()) return;
          const ocupadas = vagasOcupadas(parts, respProx.data.confirmacao_closes_at);
          setProxima({
            id: respProx.data.id,
            data_jogo: respProx.data.data_jogo,
            ocupadas,
          });
        } else {
          setProxima(null);
        }
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(e));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [ano]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (carregando) return <SkeletonResumo />;
  if (erro) {
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;
  }

  const semPartidas = !resumo || resumo.total_partidas === 0;

  const destaques: DestaqueProps[] = resumo
    ? [
        {
          titulo: 'Artilheiro Oficial',
          badge: '⚽ GOLS',
          nome: resumo.artilheiro_nome,
          valor: `${resumo.artilheiro_gols ?? 0} ${resumo.artilheiro_gols === 1 ? 'gol' : 'gols'}`,
          detalhe: `${resumo.artilheiro_partidas ?? 0} ${resumo.artilheiro_partidas === 1 ? 'partida' : 'partidas'}`,
        },
        {
          titulo: 'Maestro do Racha',
          badge: '🅰️ PASSES',
          nome: resumo.maestro_nome,
          valor: `${resumo.maestro_assistencias ?? 0} ${resumo.maestro_assistencias === 1 ? 'passe' : 'passes'}`,
          detalhe: `${resumo.maestro_partidas ?? 0} ${resumo.maestro_partidas === 1 ? 'partida' : 'partidas'}`,
        },
        {
          titulo: 'Frequência Máxima',
          badge: '🛡️ PRESENÇA',
          nome: resumo.participante_nome,
          valor: `${resumo.participante_partidas ?? 0} ${resumo.participante_partidas === 1 ? 'partida' : 'partidas'}`,
          detalhe: 'Presença garantida',
        },
        {
          titulo: 'Mais Eficiente',
          badge: '📈 % VITÓRIAS',
          nome: resumo.eficiente_nome,
          valor: `${Math.round((resumo.eficiente_percentual ?? 0) * 100)}% vitórias`,
          detalhe: `${resumo.eficiente_vitorias ?? 0}V em ${resumo.eficiente_partidas ?? 0} jogos`,
        },
        {
          titulo: 'Maior Sequência',
          badge: '🔥 EMBALADO',
          nome: resumo.sequencia_vitorias_nome,
          valor: `${resumo.sequencia_vitorias ?? 0} ${resumo.sequencia_vitorias === 1 ? 'vitória' : 'vitórias'}`,
          detalhe: 'Embalado na temporada',
        },
        {
          titulo: 'Maior Seca',
          badge: '🧊 JEJUM',
          nome: resumo.seca_vitorias_nome,
          valor: `${resumo.seca_vitorias ?? 0} ${resumo.seca_vitorias === 1 ? 'jogo' : 'jogos'}`,
          detalhe: 'A quinta não perdoa',
        },
      ]
    : [];

  return (
    <PullToRefresh onRefresh={carregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl text-giz space-y-4">
        {/* Cabeçalho Editorial de Súmula */}
        <div className="flex items-end justify-between sumula-header pb-2">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-destaque font-bold">
              BOLETIM OFICIAL DO RACHA
            </p>
            <h1 className="font-display font-bold text-2xl uppercase tracking-wider text-giz">
              TEMPORADA {ano}
            </h1>
          </div>
          <p className="font-mono text-xs font-bold text-giz-fraco tabular-nums">
            {resumo?.total_partidas ?? 0} {resumo?.total_partidas === 1 ? 'partida' : 'partidas'}
          </p>
        </div>

        <BotaoInstalar />
        <CardNotificacoes />

        <CardProximaPartida proxima={proxima} />

        {/* Grade de Destaques ou Empty State Esportivo */}
        {semPartidas ? (
          <div className="rounded-[4px] border border-borda bg-superficie p-5 text-center shadow-carimbo space-y-1">
            <p className="text-sm font-medium text-giz">
              Nenhuma partida na súmula ainda este ano.
            </p>
            <p className="text-xs text-giz-fraco font-mono">
              O primeiro jogo da temporada vai inaugurar os números oficiais.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {destaques.map((destaque) => (
              <Destaque key={destaque.titulo} {...destaque} />
            ))}
          </div>
        )}

        {/* Rodapé Editorial do Boletim */}
        <div className="pt-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Racha Gragoatá · desde 2024 · toda quinta, CBO
          </p>
        </div>
      </div>
    </PullToRefresh>
  );
}

function Destaque({ titulo, badge, nome, valor, detalhe }: DestaqueProps) {
  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo flex flex-col justify-between transition hover:border-destaque/60">
      <div>
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-giz-fraco font-bold">
            {badge ?? titulo}
          </span>
        </div>
        <p className="font-display font-black text-base uppercase tracking-wide text-giz truncate">
          {nome ?? 'Sem registro'}
        </p>
      </div>
      <div className="mt-2 pt-2 border-t border-borda">
        <p className="font-mono text-sm font-bold text-destaque tabular-nums">{valor}</p>
        {detalhe && (
          <p className="font-mono text-[10px] text-giz-fraco mt-0.5 truncate">{detalhe}</p>
        )}
      </div>
    </section>
  );
}

function CardProximaPartida({
  proxima,
}: {
  proxima: { id: number; data_jogo: string; ocupadas: number } | null;
}) {
  if (!proxima) return null;
  return (
    <Link
      to={`/partida/${proxima.id}`}
      className="block rounded-[4px] border-2 border-destaque bg-superficie px-4 py-3.5 shadow-carimbo transition active:scale-[0.99] hover:bg-superficie-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-black text-[10px] uppercase tracking-widest text-destaque-tinta bg-destaque px-2 py-0.5 rounded-[2px] shadow-xs">
          PRÓXIMA QUINTA
        </span>
        <span className="font-mono text-xs font-bold text-destaque tabular-nums">
          {proxima.ocupadas}/{CAPACIDADE_PARTIDA} VAGAS
        </span>
      </div>
      <p className="mt-2 font-display font-bold text-lg uppercase tracking-wider text-giz capitalize">
        <span className="sm:hidden">{formatarDataMobile(proxima.data_jogo)}</span>
        <span className="hidden sm:inline">{formatarDataCompleta(proxima.data_jogo)}</span>
      </p>
      <p className="mt-0.5 text-xs text-giz-fraco font-mono">
        Toque para confirmar presença ou consultar a súmula
      </p>
    </Link>
  );
}
