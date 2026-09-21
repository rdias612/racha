import { useCallback, useEffect, useState } from 'react';
import { AbasEstatisticas } from '../components/AbasEstatisticas';
import {
  carregarStatsJogador,
  compararJogadores,
  listarTodosJogadores,
  obterMediasNotasJogadores,
  type ComparativoConfronto,
  type JogadorLista,
  type PartidaConfronto,
  type StatsJogador,
} from '../lib/jogadores';
import { useSessao } from '../context/SessaoContext';
import { useCache } from '../hooks/useCache';
import { chaveComparador } from '../lib/chavesCache';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { Carregando, MensagemEstado } from '../components/Estado';
import { SkeletonComparador } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { vibrateLight } from '../lib/haptics';
import { DueloCard } from '../components/DueloCard';
import { SeletorAtletasComparador } from '../components/SeletorAtletasComparador';
import { SecaoMetricasComparador, type MetricaComparativa } from '../components/SecaoMetricasComparador';
import { SecaoJuntosComparador } from '../components/SecaoJuntosComparador';
import { SecaoAdversosComparador } from '../components/SecaoAdversosComparador';
import { HistoricoComparador } from '../components/HistoricoComparador';

// Tudo o que a tela precisa em uma ida só: confronto direto (RPCs 072) +
// números gerais da temporada + mapa de médias aparadas (RPC 070).
// `confronto === null` = par incompleto (B ainda não escolhido): sem rede.
interface ComparativoTela {
  confronto: ComparativoConfronto | null;
  statsA: StatsJogador | null;
  statsB: StatsJogador | null;
  medias: Record<number, number>;
}

const COMPARATIVO_VAZIO: ComparativoTela = {
  confronto: null,
  statsA: null,
  statsB: null,
  medias: {},
};

function aproveitamento(stats: StatsJogador | null): number | null {
  if (!stats || stats.partidas <= 0) return null;
  return (stats.vitorias / stats.partidas) * 100;
}

export function Comparador() {
  const { jogador } = useSessao();
  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [idA, setIdA] = useState<number | null>(() => jogador?.id ?? null);
  const [idB, setIdB] = useState<number | null>(null);

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ['/estatisticas/jogador', '/estatisticas/racha', '/estatisticas/comparar'],
    activeTab: '/estatisticas/comparar',
  });

  const jogadorId = jogador?.id;

  // Elenco para os seletores (randoms filtrados pela própria lib; inclui
  // veteranos inativos, que têm histórico). Effect próprio, fora do useCache:
  // por isso usa a flag `ativo` de cleanup (AGENTS.md 5.2).
  useEffect(() => {
    let ativo = true;
    listarTodosJogadores()
      .then((lista) => {
        if (!ativo) return;
        setJogadores(lista);
        if (jogadorId != null) {
          setIdA((atual) => (atual === null ? jogadorId : atual));
        }
      })
      .catch(() => {
        // Lista indisponível (offline): seletores ficam vazios e o confronto
        // em cache segue utilizável. Falha silenciosa, como em Estatisticas.
      });
    return () => {
      ativo = false;
    };
  }, [jogadorId]);

  // Função pura (apenas consulta e lança erro) — requisito do useCache
  // (AGENTS.md 5.5). Com o par incompleto resolve a estrutura vazia sem rede.
  const buscar = useCallback(async (): Promise<ComparativoTela> => {
    if (idA === null || idB === null) return COMPARATIVO_VAZIO;

    const [confronto, linhasStats, medias] = await Promise.all([
      compararJogadores(idA, idB),
      carregarStatsJogador([idA, idB]),
      obterMediasNotasJogadores(),
    ]);

    return {
      confronto,
      statsA: linhasStats.find((s) => s.jogador_id === idA) ?? null,
      statsB: linhasStats.find((s) => s.jogador_id === idB) ?? null,
      medias,
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

  if (carregando) return <SkeletonComparador />;
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
  const medias = dados?.medias ?? {};

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
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Confronto Direto
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Estatísticas CBO
          </span>
        </div>

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
