import { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { POSICOES, type PosicaoId } from "../lib/times";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { MensagemEstado } from "../components/Estado";
import { Avatar } from "../components/Avatar";
import { PullToRefresh } from "../components/PullToRefresh";
import { SkeletonRanking } from "../components/Skeletons";
import { useSwipeTabs } from "../hooks/useSwipeTabs";
import { vibrateLight } from "../lib/haptics";
import { ShieldCheck } from "lucide-react";

export type Metrica =
  | "pontos"
  | "gols"
  | "assistencias"
  | "gols-contra"
  | "luva-de-ouro";

type CampoMetrica =
  | "pontos"
  | "gols"
  | "assistencias"
  | "gols_contra"
  | "media_gols_sofridos";

type ColunaOrdenacao =
  | "nome"
  | CampoMetrica
  | "media_gols"
  | "percentual_vitorias"
  | "partidas"
  | "vitorias"
  | "empates"
  | "derrotas"
  | "gols_sofridos"
  | "clean_sheets";

type DirecaoOrdenacao = "asc" | "desc";

const numero2casas = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const metricas: Record<
  Metrica,
  { titulo: string; coluna: string; campo: CampoMetrica }
> = {
  pontos: { titulo: "Ranking de pontuação", coluna: "Pontos", campo: "pontos" },
  gols: { titulo: "Ranking de gols", coluna: "Gols", campo: "gols" },
  assistencias: {
    titulo: "Ranking de assistências",
    coluna: "Assistências",
    campo: "assistencias",
  },
  "gols-contra": {
    titulo: "Ranking de gols contra",
    coluna: "Gols contra",
    campo: "gols_contra",
  },
  "luva-de-ouro": {
    titulo: "Troféu Luva de Ouro (Goleiros Menos Vazados)",
    coluna: "Média GS",
    campo: "media_gols_sofridos",
  },
};

const RANKING_TABS = [
  "/ranking/pontos",
  "/ranking/gols",
  "/ranking/assistencias",
  "/ranking/gols-contra",
  "/ranking/luva-de-ouro",
];

interface ColunaTabela {
  key: ColunaOrdenacao;
  label: string;
}

interface LinhaRanking {
  jogador_id: number;
  nome: string;
  posicao: PosicaoId;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
}

export interface LinhaRankingGoleiro {
  jogador_id: number;
  nome: string;
  posicao: PosicaoId;
  partidas: number;
  gols_sofridos: number;
  media_gols_sofridos: number;
  clean_sheets: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  percentual_vitorias: number;
}

export function Ranking() {
  const jogadorLogado = useJogadorLogado();
  const { metrica: parametro } = useParams<{ metrica: Metrica }>();
  const metrica: Metrica =
    parametro && parametro in metricas ? parametro : "pontos";
  const configuracao = metricas[metrica];

  const swipeHandlers = useSwipeTabs({
    tabs: RANKING_TABS,
    activeTab: `/ranking/${metrica}`,
  });

  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [linhasGoleiros, setLinhasGoleiros] = useState<LinhaRankingGoleiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>(
    configuracao.campo,
  );
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>(
    metrica === "luva-de-ouro" ? "asc" : "desc",
  );
  const [posicaoFiltro, setPosicaoFiltro] = useState<PosicaoId | "todas">(
    "todas",
  );
  const [minimoPartidas, setMinimoPartidas] = useState(
    metrica === "luva-de-ouro" ? 1 : 6,
  );

  useEffect(() => {
    setPosicaoFiltro("todas");
    if (metrica === "luva-de-ouro") {
      setColunaOrdenacao("media_gols_sofridos");
      setDirecaoOrdenacao("asc");
      setMinimoPartidas(1);
    } else {
      setColunaOrdenacao(configuracao.campo);
      setDirecaoOrdenacao("desc");
      setMinimoPartidas(6);
    }
  }, [metrica, configuracao.campo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    if (metrica === "luva-de-ouro") {
      try {
        const [resPP, resPartidas, resPlacares] = await Promise.all([
          supabase
            .from("partidas_participantes")
            .select(
              "partida_id, jogador_id, time, posicao, jogadores(id, nome, posicao)",
            )
            .eq("posicao", "goleiro"),
          supabase
            .from("partidas")
            .select("id, status")
            .in("status", ["published", "closed"]),
          supabase
            .from("partida_placar")
            .select("partida_id, gols_time_a, gols_time_b, vencedor"),
        ]);

        if (resPP.error) throw resPP.error;
        if (resPartidas.error) throw resPartidas.error;
        if (resPlacares.error) throw resPlacares.error;

        const partidasValidas = new Set(
          (resPartidas.data ?? []).map((p) => p.id),
        );
        const placaresMap = new Map<
          number,
          { gols_time_a: number; gols_time_b: number; vencedor: string }
        >();
        for (const pl of resPlacares.data ?? []) {
          placaresMap.set(pl.partida_id, pl);
        }

        const statsMap = new Map<
          number,
          {
            jogador_id: number;
            nome: string;
            posicao: PosicaoId;
            partidas: number;
            gols_sofridos: number;
            clean_sheets: number;
            vitorias: number;
            empates: number;
            derrotas: number;
          }
        >();

        for (const row of (resPP.data ?? []) as any[]) {
          if (!partidasValidas.has(row.partida_id)) continue;
          const pl = placaresMap.get(row.partida_id);
          if (!pl) continue;

          const jogadorId = row.jogador_id;
          const nome = row.jogadores?.nome ?? `Jogador #${jogadorId}`;
          const posicao = (row.jogadores?.posicao ?? "goleiro") as PosicaoId;
          const time = row.time;

          const golsSofridos = time === "a" ? pl.gols_time_b : pl.gols_time_a;
          const cleanSheet = golsSofridos === 0 ? 1 : 0;
          const vitoria = pl.vencedor === time ? 1 : 0;
          const empate = pl.vencedor === "empate" ? 1 : 0;
          const derrota =
            pl.vencedor !== time && pl.vencedor !== "empate" ? 1 : 0;

          const atual = statsMap.get(jogadorId) ?? {
            jogador_id: jogadorId,
            nome,
            posicao,
            partidas: 0,
            gols_sofridos: 0,
            clean_sheets: 0,
            vitorias: 0,
            empates: 0,
            derrotas: 0,
          };

          atual.partidas += 1;
          atual.gols_sofridos += golsSofridos;
          atual.clean_sheets += cleanSheet;
          atual.vitorias += vitoria;
          atual.empates += empate;
          atual.derrotas += derrota;

          statsMap.set(jogadorId, atual);
        }

        const lista: LinhaRankingGoleiro[] = Array.from(statsMap.values()).map(
          (g) => ({
            ...g,
            media_gols_sofridos:
              g.partidas > 0 ? g.gols_sofridos / g.partidas : 0,
            percentual_vitorias: g.partidas > 0 ? g.vitorias / g.partidas : 0,
          }),
        );

        setLinhasGoleiros(lista);
      } catch (err: any) {
        setErro(err?.message ?? "Erro ao carregar ranking de goleiros.");
      } finally {
        setCarregando(false);
      }
    } else {
      try {
        let query = supabase
          .from("ranking")
          .select(
            "jogador_id, nome, posicao, pontos, vitorias, empates, derrotas, partidas, gols, assistencias, gols_contra",
          )
          .order("pontos", { ascending: false })
          .order("vitorias", { ascending: false })
          .order("partidas", { ascending: false })
          .order("gols", { ascending: false })
          .order("assistencias", { ascending: false })
          .order("nome", { ascending: true });

        if (posicaoFiltro !== "todas") {
          query = query.eq("posicao", posicaoFiltro);
        }

        const { data, error } = await query;

        if (error) {
          setErro(error.message);
        } else {
          setLinhas(data ?? []);
        }
      } catch (err: any) {
        setErro(err?.message ?? "Erro ao carregar ranking.");
      } finally {
        setCarregando(false);
      }
    }
  }, [metrica, posicaoFiltro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const maxPartidasReais =
    metrica === "luva-de-ouro"
      ? linhasGoleiros.length > 0
        ? Math.max(...linhasGoleiros.map((l) => l.partidas))
        : 0
      : linhas.length > 0
        ? Math.max(...linhas.map((linha) => linha.partidas))
        : 0;

  const maximoPartidas = Math.max(
    metrica === "luva-de-ouro" ? 1 : 6,
    maxPartidasReais,
  );

  useEffect(() => {
    if (maxPartidasReais > 0) {
      setMinimoPartidas((minimo) => Math.min(minimo, maxPartidasReais));
    }
  }, [maxPartidasReais]);

  if (carregando) return <SkeletonRanking />;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );

  function valorOrdenacao(linha: LinhaRanking, coluna: ColunaOrdenacao) {
    if (coluna === "nome") return linha.nome;
    if (coluna === "media_gols") {
      return linha.partidas > 0 ? linha.gols / linha.partidas : 0;
    }
    if (coluna === "percentual_vitorias") {
      return linha.partidas > 0 ? linha.vitorias / linha.partidas : 0;
    }
    return Number(linha[coluna as keyof LinhaRanking] ?? 0);
  }

  function valorOrdenacaoGoleiro(
    linha: LinhaRankingGoleiro,
    coluna: ColunaOrdenacao,
  ) {
    if (coluna === "nome") return linha.nome;
    if (coluna === "media_gols_sofridos") return linha.media_gols_sofridos;
    if (coluna === "gols_sofridos") return linha.gols_sofridos;
    if (coluna === "clean_sheets") return linha.clean_sheets;
    if (coluna === "percentual_vitorias") return linha.percentual_vitorias;
    if (coluna === "partidas") return linha.partidas;
    if (coluna === "vitorias") return linha.vitorias;
    if (coluna === "empates") return linha.empates;
    if (coluna === "derrotas") return linha.derrotas;
    return 0;
  }

  function selecionarOrdenacao(coluna: ColunaOrdenacao) {
    vibrateLight();
    if (coluna === colunaOrdenacao) {
      setDirecaoOrdenacao((direcao) => (direcao === "asc" ? "desc" : "asc"));
      return;
    }
    setColunaOrdenacao(coluna);
    if (metrica === "luva-de-ouro") {
      setDirecaoOrdenacao(
        coluna === "media_gols_sofridos" || coluna === "gols_sofridos"
          ? "asc"
          : coluna === "nome"
            ? "asc"
            : "desc",
      );
    } else {
      setDirecaoOrdenacao(coluna === "nome" ? "asc" : "desc");
    }
  }

  const colunasOrdenacaoGoleiros: ColunaTabela[] = [
    { key: "nome", label: "Goleiro" },
    { key: "media_gols_sofridos", label: "Média GS" },
    { key: "gols_sofridos", label: "GS" },
    { key: "clean_sheets", label: "Clean Sheets" },
    { key: "percentual_vitorias", label: "% Vitórias" },
    { key: "partidas", label: "P" },
    { key: "vitorias", label: "V" },
    { key: "empates", label: "E" },
    { key: "derrotas", label: "D" },
  ];

  const colunasOrdenacao: ColunaTabela[] = [
    { key: "nome", label: "Nome" },
    { key: configuracao.campo, label: configuracao.coluna },
    ...(metrica === "gols"
      ? [{ key: "media_gols" as const, label: "Média/partida" }]
      : []),
    { key: "percentual_vitorias", label: "% vitórias" },
    { key: "partidas", label: "P" },
    { key: "vitorias", label: "V" },
    { key: "empates", label: "E" },
    { key: "derrotas", label: "D" },
  ];

  // Ordenação normal
  const linhasOrdenadas = [...linhas].sort((a, b) => {
    const valorA = valorOrdenacao(a, colunaOrdenacao);
    const valorB = valorOrdenacao(b, colunaOrdenacao);
    const fator = direcaoOrdenacao === "asc" ? 1 : -1;

    if (typeof valorA === "string" && typeof valorB === "string") {
      return valorA.localeCompare(valorB) * fator;
    }
    return (Number(valorA) - Number(valorB)) * fator;
  });

  const linhasFiltradas = linhasOrdenadas.filter(
    (linha) => linha.partidas >= minimoPartidas,
  );

  // Ordenação goleiros (Luva de Ouro)
  const goleirosOrdenados = [...linhasGoleiros].sort((a, b) => {
    const valorA = valorOrdenacaoGoleiro(a, colunaOrdenacao);
    const valorB = valorOrdenacaoGoleiro(b, colunaOrdenacao);
    const fator = direcaoOrdenacao === "asc" ? 1 : -1;

    if (typeof valorA === "string" && typeof valorB === "string") {
      return valorA.localeCompare(valorB) * fator;
    }
    if (Number(valorA) !== Number(valorB)) {
      return (Number(valorA) - Number(valorB)) * fator;
    }
    // Desempate padrão na Luva de Ouro: mais clean sheets, mais partidas, menor gols_sofridos
    if (b.clean_sheets !== a.clean_sheets) {
      return b.clean_sheets - a.clean_sheets;
    }
    if (b.partidas !== a.partidas) {
      return b.partidas - a.partidas;
    }
    return a.gols_sofridos - b.gols_sofridos;
  });

  const goleirosFiltrados = goleirosOrdenados.filter(
    (l) => l.partidas >= minimoPartidas,
  );

  const liderLuva = goleirosFiltrados[0] ?? null;

  return (
    <PullToRefresh onRefresh={carregar}>
      <div
        {...swipeHandlers}
        className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto animate-page-enter space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
            {configuracao.titulo}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {metrica === "luva-de-ouro"
              ? "Goleiros com menor média de gols sofridos por jogo e defesas invictas"
              : "Desempenho oficial dos atletas nas partidas do Racha Gragoatá"}
          </p>
        </div>

        {/* Abas de Métricas */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
          <NavLink
            to="/ranking/pontos"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-1.5 text-center text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Pontuação
          </NavLink>
          <NavLink
            to="/ranking/gols"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-1.5 text-center text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Gols
          </NavLink>
          <NavLink
            to="/ranking/assistencias"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-1.5 text-center text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Assistências
          </NavLink>
          <NavLink
            to="/ranking/gols-contra"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-1.5 text-center text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            Gols contra
          </NavLink>
          <NavLink
            to="/ranking/luva-de-ouro"
            onClick={() => vibrateLight()}
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-lg px-3 py-1.5 text-center text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-(--cor-destaque) text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`
            }
          >
            🧤 Luva de Ouro
          </NavLink>
        </div>

        {/* Card Destaque: Líder da Luva de Ouro */}
        {metrica === "luva-de-ouro" && liderLuva && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-amber-400 text-neutral-950 font-black text-lg">
                  🧤
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 dark:text-amber-400 block">
                    Atual Dono da Luva de Ouro
                  </span>
                  <h3 className="font-heading text-base font-bold text-neutral-900 dark:text-white">
                    {liderLuva.nome}
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <span className="font-scoreboard text-2xl sm:text-3xl font-black text-amber-500 dark:text-amber-400">
                  {numero2casas.format(liderLuva.media_gols_sofridos)}
                </span>
                <span className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                  Gols sofridos / jogo
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-200/40 dark:border-neutral-800/80 pt-2.5 text-center">
              <div>
                <span className="block text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                  Clean Sheets
                </span>
                <span className="font-scoreboard text-base font-bold text-emerald-600 dark:text-emerald-400">
                  🛡️ {liderLuva.clean_sheets} jogos
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                  Total Gols Sofridos
                </span>
                <span className="font-scoreboard text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {liderLuva.gols_sofridos} GS
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                  Partidas no Gol
                </span>
                <span className="font-scoreboard text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {liderLuva.partidas} jogos
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {metrica !== "luva-de-ouro" && (
            <div>
              <label htmlFor="filtro-posicao" className="sr-only">
                Filtrar por posição
              </label>
              <select
                id="filtro-posicao"
                value={posicaoFiltro}
                onChange={(e) =>
                  setPosicaoFiltro(e.target.value as PosicaoId | "todas")
                }
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 shadow-xs cursor-pointer"
              >
                <option value="todas">Todas as posições</option>
                {Object.entries(POSICOES)
                  .filter(([chave]) => chave !== "random")
                  .map(([chave, rotulo]) => (
                    <option key={chave} value={chave}>
                      {rotulo}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex-1 max-w-xs space-y-1">
            <label
              htmlFor="filtro-minimo-partidas"
              className="flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-300"
            >
              <span>Mínimo de partidas</span>
              <strong className="text-(--cor-destaque)">{minimoPartidas}</strong>
            </label>
            <input
              id="filtro-minimo-partidas"
              type="range"
              min="1"
              max={maximoPartidas}
              value={minimoPartidas}
              onChange={(e) => setMinimoPartidas(Number(e.target.value))}
              className="w-full accent-(--cor-destaque) cursor-pointer"
            />
          </div>
        </div>

        {/* Visualização de Tabela */}
        {metrica === "luva-de-ouro" ? (
          goleirosFiltrados.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-6 text-center">
              {linhasGoleiros.length === 0
                ? "Nenhuma partida encerrada com goleiros escalados ainda."
                : "Nenhum goleiro atende ao mínimo de partidas selecionado."}
            </p>
          ) : (
            <TabelaRankingGoleiros
              linhas={goleirosFiltrados}
              colunasOrdenacao={colunasOrdenacaoGoleiros}
              colunaOrdenacao={colunaOrdenacao}
              direcaoOrdenacao={direcaoOrdenacao}
              selecionarOrdenacao={selecionarOrdenacao}
              jogadorLogadoId={jogadorLogado?.id}
            />
          )
        ) : linhasFiltradas.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-6 text-center">
            {linhas.length === 0
              ? "Nenhuma partida publicada ainda. O ranking aparece quando houver partidas."
              : "Nenhum jogador atende ao mínimo de partidas selecionado."}
          </p>
        ) : (
          <TabelaRanking
            linhas={linhasFiltradas}
            colunasOrdenacao={colunasOrdenacao}
            colunaOrdenacao={colunaOrdenacao}
            direcaoOrdenacao={direcaoOrdenacao}
            selecionarOrdenacao={selecionarOrdenacao}
            valorOrdenacao={valorOrdenacao}
            jogadorLogadoId={jogadorLogado?.id}
          />
        )}
      </div>
    </PullToRefresh>
  );
}

function TabelaRankingGoleiros({
  linhas,
  colunasOrdenacao,
  colunaOrdenacao,
  direcaoOrdenacao,
  selecionarOrdenacao,
  jogadorLogadoId,
}: {
  linhas: LinhaRankingGoleiro[];
  colunasOrdenacao: ColunaTabela[];
  colunaOrdenacao: ColunaOrdenacao;
  direcaoOrdenacao: DirecaoOrdenacao;
  selecionarOrdenacao: (coluna: ColunaOrdenacao) => void;
  jogadorLogadoId?: number;
}) {
  return (
    <div
      data-no-swipe
      className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs"
    >
      <table className="w-full min-w-120 text-sm">
        <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider">
          <tr>
            <th className="px-2.5 py-2.5 text-left w-8">#</th>
            {colunasOrdenacao.map((coluna) => {
              const ativa = colunaOrdenacao === coluna.key;
              const direcao = ativa ? direcaoOrdenacao : null;
              return (
                <th
                  key={coluna.key}
                  aria-sort={
                    direcao === "asc"
                      ? "ascending"
                      : direcao === "desc"
                        ? "descending"
                        : "none"
                  }
                  className={`px-2 py-2.5 ${
                    coluna.key === "nome"
                      ? "w-px whitespace-nowrap text-left sm:min-w-48"
                      : "text-right whitespace-nowrap"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selecionarOrdenacao(coluna.key)}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-900 dark:hover:text-white"
                  >
                    {coluna.key === "media_gols_sofridos" && (
                      <ShieldCheck className="size-3 text-amber-500" />
                    )}
                    {coluna.label}
                    <span aria-hidden="true" className="text-[10px]">
                      {direcao === "asc"
                        ? "▲"
                        : direcao === "desc"
                          ? "▼"
                          : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {linhas.map((l, i) => {
            const primeiro = i === 0;
            const ehLogado = l.jogador_id === jogadorLogadoId;
            return (
              <tr
                key={l.jogador_id}
                className={
                  ehLogado
                    ? "bg-(--cor-destaque)/10"
                    : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
                }
              >
                <td className="px-2.5 py-2 text-neutral-500 dark:text-neutral-400 font-bold">
                  {primeiro ? "🧤" : i + 1}
                </td>
                {colunasOrdenacao.map((coluna) => (
                  <td
                    key={coluna.key}
                    className={`px-2 py-2 text-neutral-700 dark:text-neutral-300 ${
                      coluna.key === "nome"
                        ? "whitespace-nowrap font-medium"
                        : "text-right"
                    }`}
                  >
                    {coluna.key === "nome" ? (
                      <div className="flex items-center gap-2">
                        <Avatar nome={l.nome} posicao={l.posicao} size="xs" />
                        <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                          {l.nome}
                        </span>
                        {primeiro && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30">
                            Luva de Ouro
                          </span>
                        )}
                      </div>
                    ) : coluna.key === "media_gols_sofridos" ? (
                      <span className="font-scoreboard font-extrabold text-(--cor-destaque)">
                        {numero2casas.format(l.media_gols_sofridos)}
                      </span>
                    ) : coluna.key === "clean_sheets" ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {l.clean_sheets}
                      </span>
                    ) : coluna.key === "percentual_vitorias" ? (
                      `${Math.round(l.percentual_vitorias * 100)}%`
                    ) : (
                      l[coluna.key as keyof LinhaRankingGoleiro]
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaRanking({
  linhas,
  colunasOrdenacao,
  colunaOrdenacao,
  direcaoOrdenacao,
  selecionarOrdenacao,
  valorOrdenacao,
  jogadorLogadoId,
}: {
  linhas: LinhaRanking[];
  colunasOrdenacao: ColunaTabela[];
  colunaOrdenacao: ColunaOrdenacao;
  direcaoOrdenacao: DirecaoOrdenacao;
  selecionarOrdenacao: (coluna: ColunaOrdenacao) => void;
  valorOrdenacao: (
    linha: LinhaRanking,
    coluna: ColunaOrdenacao,
  ) => number | string;
  jogadorLogadoId?: number;
}) {
  return (
    <div
      data-no-swipe
      className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs"
    >
      <table className="w-full min-w-120 text-sm">
        <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider">
          <tr>
            <th className="px-2.5 py-2.5 text-left w-8">#</th>
            {colunasOrdenacao.map((coluna) => {
              const ativa = colunaOrdenacao === coluna.key;
              const direcao = ativa ? direcaoOrdenacao : null;
              return (
                <th
                  key={coluna.key}
                  aria-sort={
                    direcao === "asc"
                      ? "ascending"
                      : direcao === "desc"
                        ? "descending"
                        : "none"
                  }
                  className={`px-2 py-2.5 ${
                    coluna.key === "nome"
                      ? "w-px whitespace-nowrap text-left sm:min-w-48"
                      : "text-right whitespace-nowrap"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selecionarOrdenacao(coluna.key)}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-900 dark:hover:text-white"
                  >
                    {coluna.label}
                    <span aria-hidden="true" className="text-[10px]">
                      {direcao === "asc"
                        ? "▲"
                        : direcao === "desc"
                          ? "▼"
                          : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {linhas.map((l, i) => {
            const primeiro = i === 0;
            const ehLogado = l.jogador_id === jogadorLogadoId;
            return (
              <tr
                key={l.jogador_id}
                className={
                  ehLogado
                    ? "bg-(--cor-destaque)/10"
                    : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
                }
              >
                <td className="px-2.5 py-2 text-neutral-500 dark:text-neutral-400 font-bold">
                  {primeiro ? "🏆" : i + 1}
                </td>
                {colunasOrdenacao.map((coluna) => (
                  <td
                    key={coluna.key}
                    className={`px-2 py-2 text-neutral-700 dark:text-neutral-300 ${
                      coluna.key === "nome"
                        ? "whitespace-nowrap font-medium"
                        : "text-right"
                    }`}
                  >
                    {coluna.key === "nome" ? (
                      <div className="flex items-center gap-2">
                        <Avatar nome={l.nome} posicao={l.posicao} size="xs" />
                        <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                          {l.nome}
                        </span>
                      </div>
                    ) : coluna.key === "media_gols" ? (
                      numero2casas.format(
                        Number(valorOrdenacao(l, coluna.key)),
                      )
                    ) : coluna.key === "percentual_vitorias" ? (
                      `${Math.round(
                        Number(valorOrdenacao(l, coluna.key)) * 100,
                      )}%`
                    ) : (
                      l[coluna.key as keyof LinhaRanking]
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
