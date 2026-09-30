import { useCallback, useEffect, useState } from 'react';
import { AbasEstatisticas } from '../components/AbasEstatisticas';
import {
  carregarStatsJogador,
  compararJogadores,
  listarTodosJogadores,
  obterMediasNotasJogadores,
  type ComparativoConfronto,
  type PartidaConfronto,
  type StatsJogador,
} from '../lib/jogadores';
import { useSessao } from '../context/SessaoContext';
import { useCache } from '../hooks/useCache';
import { CHAVE_ELENCO_TODOS, CHAVE_MEDIAS_NOTAS, chaveComparador } from '../lib/chavesCache';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { Carregando, MensagemEstado } from '../components/Estado';
import { SkeletonComparador } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { vibrateLight } from '../lib/haptics';
import { DueloCard } from '../components/DueloCard';
import { SeletorAtletasComparador } from '../components/SeletorAtletasComparador';
import {
  SecaoMetricasComparador,
  type MetricaComparativa,
} from '../components/SecaoMetricasComparador';
import { SecaoJuntosComparador } from '../components/SecaoJuntosComparador';
import { SecaoAdversosComparador } from '../components/SecaoAdversosComparador';
import { HistoricoComparador } from '../components/HistoricoComparador';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';

// Tudo o que a tela precisa em uma ida só: confronto direto (RPCs 072) +
// números gerais da temporada. As médias aparadas (RPC 070) vêm do cache
// próprio (CHAVE_MEDIAS_NOTAS) e são mescladas no resultado exibido.
// `confronto === null` = par incompleto (B ainda não escolhido): sem rede.
interface ComparativoTela {
  confronto: ComparativoConfronto | null;
  statsA: StatsJogador | null;
  statsB: StatsJogador | null;
}

const COMPARATIVO_VAZIO: ComparativoTela = {
  confronto: null,
  statsA: null,
  statsB: null,
};

function aproveitamento(stats: StatsJogador | null): number | null {
  if (!stats || stats.partidas <= 0) return null;
  return (stats.vitorias / stats.partidas) * 100;
}

export function Comparador() {
  const { jogador } = useSessao();
  const [idA, setIdA] = useState<number | null>(() => jogador?.id ?? null);
  const [idB, setIdB] = useState<number | null>(null);

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ['/estatisticas/jogador', '/estatisticas/racha', '/estatisticas/comparar'],
    activeTab: '/estatisticas/comparar',
  });

  const jogadorId = jogador?.id;

  // Elenco para os seletores (randoms filtrados pela própria lib; inclui
  // veteranos inativos, que têm histórico). Falha de rede deixa os seletores
  // vazios e o confronto em cache segue utilizável.
  const { dados: elenco } = useCache(CHAVE_ELENCO_TODOS, listarTodosJogadores);
  const jogadores = elenco ?? [];

  // Médias aparadas fora do fetcher do par: trocar o par de atletas não
  // re-busca as médias (uma requisição a menos por comparação).
  const { dados: mediasCarregadas, carregando: carregandoMedias } = useCache(
    CHAVE_MEDIAS_NOTAS,
    obterMediasNotasJogadores
  );
  const medias = mediasCarregadas ?? {};

  // Lado A padrão: o atleta logado, assim que a sessão terminar de hidratar.
  useEffect(() => {
    if (jogadorId != null) {
      setIdA((atual) => (atual === null ? jogadorId : atual));
    }
  }, [jogadorId]);

  // Função pura (apenas consulta e lança erro) — requisito do useCache
  // (AGENTS.md 5.5). Com o par incompleto resolve a estrutura vazia sem rede.
  const buscar = useCallback(async (): Promise<ComparativoTela> => {
    if (idA === null || idB === null) return COMPARATIVO_VAZIO;

    const [confronto, linhasStats] = await Promise.all([
      compararJogadores(idA, idB),
      carregarStatsJogador([idA, idB]),
    ]);

    return {
      confronto,
      statsA: linhasStats.find((s) => s.jogador_id === idA) ?? null,
      statsB: linhasStats.find((s) => s.jogador_id === idB) ?? null,
    };
  }, [idA, idB]);

  // A chave carrega os filtros (o par de ids): trocar o adversário ou inverter
  // os lados busca de novo; voltar a um par já visto sai grátis do cache.
  const { dados, carregando, erro, recarregar } = useCache<ComparativoTela>(
    chaveComparador(idA, idB),
    buscar
  );

  function trocarLados() {
    if (idA === null || idB === null) return;
    vibrateLight();
    setIdA(idB);
    setIdB(idA);
  }

  if (carregando || carregandoMedias) return <SkeletonComparador />;
  if (erro && !dados)
    return (
      <MensagemEstado tipo="erro" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );

  const confronto = dados?.confronto ?? null;
  const juntosA = confronto?.linhas.find((l) => l.lado === 'a' && l.bloco === 'juntos');
  const juntosB = confronto?.linhas.find((l) => l.lado === 'b' && l.bloco === 'juntos');
  const adversosA = confronto?.linhas.find((l) => l.lado === 'a' && l.bloco === 'adversos');
  const adversosB = confronto?.linhas.find((l) => l.lado === 'b' && l.bloco === 'adversos');
  const historico = confronto?.partidas ?? [];

  // B aberto (ou resposta ainda em voo após a escolha): só o duelo e os seletores.
  const semConfronto = idB === null || confronto === null;

  const infoA =
    idA === null
      ? undefined
      : (jogadores.find((j) => j.id === idA) ??
        (jogador?.id === idA
          ? { username: jogador.username, posicao: jogador.posicao }
          : undefined));
  const infoB =
    idB === null
      ? undefined
      : (jogadores.find((j) => j.id === idB) ??
        (jogador?.id === idB
          ? { username: jogador.username, posicao: jogador.posicao }
          : undefined));
  const usernameA = infoA?.username ?? '—';
  const usernameB = infoB?.username ?? '—';

  const statsA = dados?.statsA ?? null;
  const statsB = dados?.statsB ?? null;

  const metricas: MetricaComparativa[] = [
    { rotulo: 'Partidas', valorA: statsA?.partidas ?? 0, valorB: statsB?.partidas ?? 0 },
    { rotulo: 'Vitórias', valorA: statsA?.vitorias ?? 0, valorB: statsB?.vitorias ?? 0 },
    {
      rotulo: 'Aproveitamento',
      valorA: aproveitamento(statsA),
      valorB: aproveitamento(statsB),
      exibir: (v) => (v === null ? '—' : `${Math.round(v)}%`),
    },
    { rotulo: 'Gols', valorA: statsA?.gols ?? 0, valorB: statsB?.gols ?? 0 },
    {
      rotulo: 'Assistências',
      valorA: statsA?.assistencias ?? 0,
      valorB: statsB?.assistencias ?? 0,
    },
    {
      rotulo: 'Gols contra',
      valorA: statsA?.gols_contra ?? 0,
      valorB: statsB?.gols_contra ?? 0,
      menorMelhor: true,
    },
    {
      rotulo: 'Média',
      valorA: idA !== null ? (medias[idA] ?? null) : null,
      valorB: idB !== null ? (medias[idB] ?? null) : null,
      exibir: (v) => (v === null ? '—' : v.toFixed(1)),
    },
  ];

  // Em times opostos, marca qual atleta levou a melhor no duelo (vencedor é o
  // time 'a'/'b' da partida; time_a é o lado de A). Retorna 'a' | 'b' | null.
  function resolverVencedor(p: PartidaConfronto): 'a' | 'b' | null {
    if (p.relacao === 'adversos' && p.vencedor !== 'empate') {
      return p.vencedor === p.time_a ? 'a' : 'b';
    }
    return null;
  }

  return (
    <PullToRefresh onRefresh={recarregar}>
      <div
        className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 touch-pan-y text-giz"
        {...swipeHandlers}
      >
        {/* Cabeçalho da Súmula */}
        <CabecalhoSumula titulo="Confronto Direto" acao="Estatísticas CBO" />

        {/* Abas */}
        <AbasEstatisticas />

        {/* Card do Duelo */}
        <DueloCard
          usernameA={usernameA}
          usernameB={usernameB}
          idBSelecionado={idB !== null}
          onTrocarLados={trocarLados}
        />

        {/* Seletores A/B */}
        <SeletorAtletasComparador
          jogadores={jogadores}
          idA={idA}
          idB={idB}
          idLogado={jogador?.id ?? null}
          aoMudarA={setIdA}
          aoMudarB={setIdB}
        />

        {semConfronto ? (
          idB === null ? (
            <MensagemEstado tipo="info">
              Escolha dois atletas para abrir o confronto.
            </MensagemEstado>
          ) : (
            // B recém-escolhido (ou lados invertidos sem cache): resposta ainda
            // em voo — o useCache mantém a estrutura vazia até a chegada dos dados.
            <Carregando compacto className="pt-2">
              Levantando o confronto…
            </Carregando>
          )
        ) : (
          <>
            {/* Números na Temporada — lista contínua comparativa */}
            <SecaoMetricasComparador metricas={metricas} />

            {/* Juntos */}
            <SecaoJuntosComparador
              usernameA={usernameA}
              usernameB={usernameB}
              linhaA={juntosA}
              linhaB={juntosB}
            />

            {/* Adversos */}
            <SecaoAdversosComparador
              usernameA={usernameA}
              usernameB={usernameB}
              linhaA={adversosA}
              linhaB={adversosB}
            />

            {/* Últimos Confrontos */}
            <HistoricoComparador
              historico={historico}
              usernameA={usernameA}
              usernameB={usernameB}
              resolverVencedor={resolverVencedor}
            />
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
