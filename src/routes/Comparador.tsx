import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Trophy } from 'lucide-react';
import { AbasEstatisticas } from '../components/AbasEstatisticas';
import {
  carregarStatsJogador,
  compararJogadores,
  listarTodosJogadores,
  obterMediasNotasJogadores,
  type ComparativoConfronto,
  type JogadorLista,
  type LinhaConfronto,
  type StatsJogador,
} from '../lib/jogadores';
import type { PosicaoId } from '../lib/times';
import { useSessao } from '../context/SessaoContext';
import { useCache } from '../hooks/useCache';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { Carregando, MensagemEstado } from '../components/Estado';
import { SkeletonComparador } from '../components/Skeletons';
import { PullToRefresh } from '../components/PullToRefresh';
import { Avatar } from '../components/Avatar';
import { formatarDataLista } from '../lib/formatacao';
import { vibrateLight } from '../lib/haptics';
import { preCarregarRota } from '../lib/rotas';

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

// Badge compacta neutra (relação do confronto e empate) — mesmo padrão das
// badges de Estatisticas.tsx/Perfil.tsx.
const classeBadgeNeutra =
  'rounded-[2px] border border-borda bg-superficie-2 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco';

function aproveitamento(stats: StatsJogador | null): number | null {
  if (!stats || stats.partidas <= 0) return null;
  return (stats.vitorias / stats.partidas) * 100;
}

interface MetricaComparativa {
  rotulo: string;
  valorA: number | null;
  valorB: number | null;
  /** True quando o menor valor é o melhor (ex.: gols contra). */
  menorMelhor?: boolean;
  /** Formatador opcional (percentual, média com decimal, em-dash). */
  exibir?: (valor: number | null) => string;
}

function exibirValorMetrica(metrica: MetricaComparativa, valor: number | null): string {
  if (metrica.exibir) return metrica.exibir(valor);
  return String(valor ?? 0);
}

/**
 * Username do atleta que levou a melhor no duelo, ou null quando não há
 * vencedor (juntos/empate) ou quando o username do lado não foi resolvido (fallback
 * '—'): sem dono identificado, o troféu não renderiza — só o placar âmbar.
 */
function primeiroNomeVencedor(
  vencedor: 'a' | 'b' | null,
  usernameLadoA: string,
  usernameLadoB: string
): string | null {
  if (vencedor === null) return null;
  const username = (vencedor === 'a' ? usernameLadoA : usernameLadoB).trim();
  if (!username || username === '—') return null;
  return `@${username}`;
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
    `comparar:${idA ?? '-'}:${idB ?? '-'}`,
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
        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center gap-2">
            <LadoDuelo username={usernameA} posicao={infoA?.posicao} />
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className="font-mono text-lg font-black leading-none text-giz-fraco"
              >
                ×
              </span>
              <button
                type="button"
                onClick={trocarLados}
                disabled={idB === null}
                aria-label="Inverter lados do confronto"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-borda bg-superficie-2 p-2 text-giz shadow-carimbo transition hover:bg-superficie hover:text-destaque active:translate-y-px focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeftRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            <LadoDuelo username={usernameB} posicao={infoB?.posicao} />
          </div>
        </div>

        {/* Seletores A/B */}
        <div className="grid grid-cols-1 gap-2 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="select-atleta-a"
              className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco"
            >
              Atleta A
            </label>
            <select
              id="select-atleta-a"
              value={idA ?? ''}
              onChange={(e) => setIdA(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
            >
              <option value="">Escolha o atleta…</option>
              {jogadores.map((j) => (
                <option key={j.id} value={j.id} disabled={j.id === idB}>
                  @{j.username}
                  {j.id === jogador?.id ? ' (eu)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="select-atleta-b"
              className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco"
            >
              Atleta B
            </label>
            <select
              id="select-atleta-b"
              value={idB ?? ''}
              onChange={(e) => setIdB(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
            >
              <option value="">Escolha o adversário…</option>
              {jogadores.map((j) => (
                <option key={j.id} value={j.id} disabled={j.id === idA}>
                  @{j.username}
                  {j.id === jogador?.id ? ' (eu)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            <section className="space-y-2">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
                Números na Temporada
              </h3>
              <div className="divide-y divide-borda/40 border-y border-borda">
                {metricas.map((metrica) => (
                  <LinhaComparativa key={metrica.rotulo} metrica={metrica} />
                ))}
              </div>
            </section>

            {/* Juntos */}
            <section className="space-y-2">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
                Quando Vestem o Mesmo Manto
              </h3>
              {juntosA && juntosA.partidas > 0 ? (
                <div className="space-y-2.5 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
                  <div className="flex items-center justify-between gap-2 border-b border-borda pb-2">
                    <span className="font-mono text-[11px] text-giz-fraco">
                      {juntosA.partidas}{' '}
                      {juntosA.partidas === 1 ? 'partida no mesmo time' : 'partidas no mesmo time'}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-giz">
                      {juntosA.vitorias}V {juntosA.empates}E {juntosA.derrotas}D
                    </span>
                  </div>
                  <LinhaAtletaContexto username={usernameA} linha={juntosA} />
                  {juntosB && <LinhaAtletaContexto username={usernameB} linha={juntosB} />}
                </div>
              ) : (
                <MensagemEstado tipo="info">Ainda não dividiram o mesmo time.</MensagemEstado>
              )}
            </section>

            {/* Adversos */}
            <section className="space-y-2">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
                Quando se Enfrentam
              </h3>
              {adversosA && adversosA.partidas > 0 ? (
                <div className="space-y-2.5 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
                  <div className="border-b border-borda pb-2">
                    <span className="font-mono text-[11px] text-giz-fraco">
                      {adversosA.partidas}{' '}
                      {adversosA.partidas === 1
                        ? 'duelo em campos opostos'
                        : 'duelos em campos opostos'}
                    </span>
                  </div>
                  <LinhaAtletaContexto username={usernameA} linha={adversosA} comRetrospecto />
                  {adversosB && (
                    <LinhaAtletaContexto username={usernameB} linha={adversosB} comRetrospecto />
                  )}
                </div>
              ) : (
                <MensagemEstado tipo="info">
                  Ainda não se enfrentaram em campos opostos.
                </MensagemEstado>
              )}
            </section>

            {/* Últimos Confrontos */}
            <section className="space-y-2">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
                Últimos Confrontos
              </h3>
              {historico.length === 0 ? (
                <MensagemEstado tipo="info">
                  Estes atletas ainda não se cruzaram em súmula nenhuma.
                </MensagemEstado>
              ) : (
                <div className="divide-y divide-borda/40 border-y border-borda">
                  {historico.map((p) => {
                    // gols_time_a/b são os gols dos times 'a'/'b' da partida;
                    // time_a é o time do ATLETA A — inverte quando A jogou no branco.
                    const golsA = p.time_a === 'a' ? p.gols_time_a : p.gols_time_b;
                    const golsB = p.time_a === 'a' ? p.gols_time_b : p.gols_time_a;
                    const destino = `/partida/${p.partida_id}`;
                    // Em times opostos, marca qual atleta levou a melhor no duelo
                    // (vencedor é o time 'a'/'b' da partida; time_a é o lado de A).
                    let vencedor: 'a' | 'b' | null = null;
                    if (p.relacao === 'adversos' && p.vencedor !== 'empate') {
                      vencedor = p.vencedor === p.time_a ? 'a' : 'b';
                    }
                    const empate = p.relacao === 'adversos' && p.vencedor === 'empate';
                    const nomeVencedor = primeiroNomeVencedor(vencedor, usernameA, usernameB);
                    return (
                      <Link
                        key={p.partida_id}
                        to={destino}
                        onTouchStart={() => preCarregarRota(destino)}
                        onMouseEnter={() => preCarregarRota(destino)}
                        onFocus={() => preCarregarRota(destino)}
                        className="flex min-h-[44px] items-center justify-between gap-2 px-1 py-2 transition hover:bg-superficie-2/50 focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
                      >
                        <span className="font-mono text-xs text-giz-fraco">
                          {formatarDataLista(p.data_jogo)}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-giz">
                          <span className={vencedor === 'a' ? 'text-destaque' : undefined}>
                            {golsA}
                          </span>
                          {' × '}
                          <span className={vencedor === 'b' ? 'text-destaque' : undefined}>
                            {golsB}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className={classeBadgeNeutra}>
                            {p.relacao === 'juntos' ? 'Juntos' : 'Rival'}
                          </span>
                          {nomeVencedor && (
                            <span className="inline-flex max-w-28 items-center gap-1 rounded-[2px] bg-destaque px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-destaque-tinta">
                              <Trophy className="size-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{nomeVencedor}</span>
                              <span className="sr-only">venceu o duelo</span>
                            </span>
                          )}
                          {empate && <span className={classeBadgeNeutra}>Empate</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

/** Um lado do card do duelo: avatar com plaqueta de posição + nome display. */
function LadoDuelo({ username, posicao }: { username: string; posicao?: PosicaoId }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <Avatar username={username} posicao={posicao} size="lg" />
      <span className="w-full truncate text-center font-display text-sm font-bold uppercase tracking-wider text-giz">
        {username === '—' ? '—' : `@${username}`}
      </span>
    </div>
  );
}

/** Linha da lista contínua comparativa: valor A | rótulo | valor B + barra. */
function LinhaComparativa({ metrica }: { metrica: MetricaComparativa }) {
  const { rotulo, valorA, valorB, menorMelhor = false } = metrica;

  let dominante: 'a' | 'b' | null = null;
  if (valorA !== null && valorB !== null && valorA !== valorB) {
    dominante = menorMelhor ? (valorA < valorB ? 'a' : 'b') : valorA > valorB ? 'a' : 'b';
  }

  const barraA = valorA ?? 0;
  const barraB = valorB ?? 0;
  const total = barraA + barraB;
  const percentualA = total > 0 ? (barraA / total) * 100 : 50;

  return (
    <div className="px-1 py-2.5 transition hover:bg-superficie-2/50">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums ${
            dominante === 'a' ? 'text-destaque' : 'text-giz'
          }`}
        >
          {exibirValorMetrica(metrica, valorA)}
        </span>
        <span className="flex-1 text-center font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco">
          {rotulo}
        </span>
        <span
          className={`w-12 shrink-0 text-left font-mono text-sm font-bold tabular-nums ${
            dominante === 'b' ? 'text-destaque' : 'text-giz'
          }`}
        >
          {exibirValorMetrica(metrica, valorB)}
        </span>
      </div>
      {/* Barra de domínio: preto = lado A, branco = lado B (contraste visual
          dos lados do comparativo, não a camisa de nenhum time). */}
      <div
        aria-hidden="true"
        className="mt-2 flex h-1.5 overflow-hidden rounded-[2px] border border-borda"
      >
        <div className="bg-preto-time" style={{ width: `${percentualA}%` }} />
        <div className="bg-branco-time" style={{ width: `${100 - percentualA}%` }} />
      </div>
    </div>
  );
}

/** Produção de um atleta num contexto (juntos/adversos) do confronto. */
function LinhaAtletaContexto({
  username,
  linha,
  comRetrospecto = false,
}: {
  username: string;
  linha: LinhaConfronto;
  comRetrospecto?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar username={username} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-giz">
          {username === '—' ? '—' : `@${username}`}
        </p>
        {comRetrospecto && (
          <p className="font-mono text-[11px] tabular-nums text-giz-fraco">
            {linha.vitorias}V {linha.empates}E {linha.derrotas}D
          </p>
        )}
      </div>
      <p className="shrink-0 font-mono text-[11px] tabular-nums text-giz-fraco">
        <span className="font-bold text-giz">{linha.gols}</span>G{' '}
        <span className="font-bold text-giz">{linha.assistencias}</span>A{' '}
        <span aria-hidden="true">·</span>{' '}
        {linha.media_nota != null ? linha.media_nota.toFixed(1) : '—'}
      </p>
    </div>
  );
}
