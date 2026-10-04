import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MensagemEstado } from '../components/Estado';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { SkeletonResumo } from '../components/Skeletons';
import { BotaoInstalar } from '../components/BotaoInstalar';
import { CardNotificacoes } from '../components/CardNotificacoes';
import { PullToRefresh } from '../components/PullToRefresh';

import {
  carregarParticipantes,
  carregarResumoAno,
  vagasOcupadas,
  CAPACIDADE_PARTIDA,
  obterPartidaDraftAtual,
  type Participante,
  type ResumoAno,
} from '../lib/partidas';
import { formatarDataCompleta, formatarDataMobile } from '../lib/formatacao';
import { useCache } from '../hooks/useCache';
import { chaveResumo, CHAVE_ULTIMA_PARTIDA_COM_CLIPES } from '../lib/chavesCache';
import {
  obterUltimaPartidaComClipes,
  type UltimaPartidaComClipes,
} from '../lib/clipes';

// Próxima partida draft com o elenco completo: permite ao card derivar vagas
// e o estado de confirmação do próprio jogador sem query adicional.
interface ProximaPartida {
  id: number;
  data_jogo: string;
  confirmacao_closes_at: string | null;
  participantes: Participante[];
}

interface DadosResumo {
  resumo: ResumoAno | null;
  proxima: ProximaPartida | null;
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

  // Boletim completo (RPC resumo_ano + próxima partida draft + ocupação de vagas)
  // cacheado por ano: revisitas renderizam na hora e revalidam em background.
  const buscar = useCallback(async (): Promise<DadosResumo> => {
    const [resumo, draftAtual] = await Promise.all([
      carregarResumoAno(ano),
      obterPartidaDraftAtual(),
    ]);

    let proxima: DadosResumo['proxima'] = null;
    if (draftAtual) {
      const parts = await carregarParticipantes(draftAtual.id);
      proxima = {
        id: draftAtual.id,
        data_jogo: draftAtual.data_jogo,
        confirmacao_closes_at: draftAtual.confirmacao_closes_at,
        participantes: parts,
      };
    }

    return { resumo, proxima };
  }, [ano]);

  const { dados, carregando, erro, recarregar } = useCache<DadosResumo>(chaveResumo(ano), buscar);

  // RF05: link "clipes da última partida" — independe dos destaques do ano
  // (P9: aparece inclusive no empty state `semPartidas`). Erro/carregando
  // deixam o card de fora (card opcional não quebra nem atrasa a home).
  const { dados: ultimaComClipes } = useCache<UltimaPartidaComClipes | null>(
    CHAVE_ULTIMA_PARTIDA_COM_CLIPES,
    obterUltimaPartidaComClipes
  );

  const resumo = dados?.resumo ?? null;
  const proxima = dados?.proxima ?? null;

  if (carregando) return <SkeletonResumo />;
  // Erro apenas na primeira visita (sem cache): com dados em tela, a falha de
  // revalidação em background é tolerada silenciosamente.
  if (erro && !dados) {
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;
  }

  const semPartidas = !resumo || resumo.total_partidas === 0;

  const destaques: DestaqueProps[] = resumo
    ? [
        {
          titulo: 'Artilheiro Oficial',
          badge: '⚽ GOLS',
          nome: resumo.artilheiro_username ?? null,
          valor: `${resumo.artilheiro_gols ?? 0} ${resumo.artilheiro_gols === 1 ? 'gol' : 'gols'}`,
          detalhe: `${resumo.artilheiro_partidas ?? 0} ${resumo.artilheiro_partidas === 1 ? 'partida' : 'partidas'}`,
        },
        {
          titulo: 'Maestro do Racha',
          badge: '🅰️ PASSES',
          nome: resumo.maestro_username ?? null,
          valor: `${resumo.maestro_assistencias ?? 0} ${resumo.maestro_assistencias === 1 ? 'passe' : 'passes'}`,
          detalhe: `${resumo.maestro_partidas ?? 0} ${resumo.maestro_partidas === 1 ? 'partida' : 'partidas'}`,
        },
        {
          titulo: 'Frequência Máxima',
          badge: '🛡️ PRESENÇA',
          nome: resumo.participante_username ?? null,
          valor: `${resumo.participante_partidas ?? 0} ${resumo.participante_partidas === 1 ? 'partida' : 'partidas'}`,
          detalhe: 'Presença garantida',
        },
        {
          titulo: 'Mais Eficiente',
          badge: '📈 % VITÓRIAS',
          nome: resumo.eficiente_username ?? null,
          valor: `${Math.round(resumo.eficiente_percentual ?? 0)}% vitórias`,
          detalhe: `${resumo.eficiente_vitorias ?? 0}V em ${resumo.eficiente_partidas ?? 0} jogos`,
        },
        {
          titulo: 'Maior Sequência',
          badge: '🔥 EMBALADO',
          nome: resumo.sequencia_vitorias_username ?? null,
          valor: `${resumo.sequencia_vitorias ?? 0} ${resumo.sequencia_vitorias === 1 ? 'vitória' : 'vitórias'}`,
          detalhe: 'Embalado na temporada',
        },
        {
          titulo: 'Maior Seca',
          badge: '🧊 JEJUM',
          nome: resumo.seca_vitorias_username ?? null,
          valor: `${resumo.seca_vitorias ?? 0} ${resumo.seca_vitorias === 1 ? 'jogo' : 'jogos'}`,
          detalhe: 'A quinta não perdoa',
        },
      ]
    : [];

  return (
    <PullToRefresh onRefresh={recarregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl text-giz space-y-4">
        {/* Cabeçalho Editorial de Súmula */}
        <CabecalhoSumula
          titulo={`TEMPORADA ${ano}`}
          nivel="h1"
          tamanho="lg"
          kicker={
            <p className="text-[10px] font-mono uppercase tracking-widest text-destaque-texto font-bold">
              BOLETIM OFICIAL DO RACHA
            </p>
          }
          acao={
            <p className="font-mono text-xs font-bold text-giz-fraco tabular-nums">
              {resumo?.total_partidas ?? 0} {resumo?.total_partidas === 1 ? 'partida' : 'partidas'}
            </p>
          }
          className="items-end"
        />

        <BotaoInstalar />
        <CardNotificacoes ocultarQuandoAtivo />

        <CardProximaPartida proxima={proxima} />

        <CardClipesDisponiveis ultima={ultimaComClipes ?? null} />

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
            Racha Gragoatá · desde 2022 · toda quinta, CBO
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
        <p className="font-mono text-sm font-bold text-destaque-texto tabular-nums">{valor}</p>
        {detalhe && (
          <p className="font-mono text-[10px] text-giz-fraco mt-0.5 truncate">{detalhe}</p>
        )}
      </div>
    </section>
  );
}

function CardClipesDisponiveis({ ultima }: { ultima: UltimaPartidaComClipes | null }) {
  if (!ultima) return null;
  return (
    <Link
      to={`/partida/${ultima.partidaId}`}
      className="block rounded-[4px] border-2 border-destaque bg-superficie px-4 py-3.5 shadow-carimbo transition active:scale-[0.99] hover:bg-superficie-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-black text-[10px] uppercase tracking-widest text-destaque-tinta bg-destaque px-2 py-0.5 rounded-[2px] shadow-xs">
          🎥 CLIPES DA ÚLTIMA PARTIDA
        </span>
        <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
          {ultima.totalClipes} {ultima.totalClipes === 1 ? 'CLIPE' : 'CLIPES'}
        </span>
      </div>
      <p className="mt-2 font-display font-bold text-lg uppercase tracking-wider text-giz capitalize">
        <span className="sm:hidden">{formatarDataMobile(ultima.dataJogo)}</span>
        <span className="hidden sm:inline">{formatarDataCompleta(ultima.dataJogo)}</span>
      </p>
      <p className="mt-0.5 text-xs text-giz-fraco font-mono">
        Toque para rever os melhores momentos
      </p>
    </Link>
  );
}

function CardProximaPartida({ proxima }: { proxima: ProximaPartida | null }) {
  if (!proxima) return null;
  const ocupadas = vagasOcupadas(proxima.participantes);
  return (
    <Link
      to={`/partida/${proxima.id}`}
      className="block rounded-[4px] border-2 border-destaque bg-superficie px-4 py-3.5 shadow-carimbo transition active:scale-[0.99] hover:bg-superficie-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-black text-[10px] uppercase tracking-widest text-destaque-tinta bg-destaque px-2 py-0.5 rounded-[2px] shadow-xs">
          PRÓXIMA QUINTA
        </span>
        <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
          {ocupadas}/{CAPACIDADE_PARTIDA} VAGAS
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
