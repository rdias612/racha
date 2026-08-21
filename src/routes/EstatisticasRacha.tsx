import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { MensagemEstado } from "../components/Estado";
import { SkeletonEstatisticas } from "../components/Skeletons";
import { DuplaCard } from "../components/DuplaCard";
import { SecaoRacha } from "../components/SecaoRacha";
import { Avatar } from "../components/Avatar";
import { PullToRefresh } from "../components/PullToRefresh";
import { carregarParesRacha, type ParRacha } from "../lib/partidas";
import { useSwipeTabs } from "../hooks/useSwipeTabs";

const MIN_PARTIDAS = 5;

export type ColunaOrdenacaoDuplas =
  | "pontos"
  | "partidas"
  | "percentual"
  | "vitorias"
  | "dupla";

export type DirecaoOrdenacao = "asc" | "desc";

function compararPares(
  a: ParRacha,
  b: ParRacha,
  coluna: ColunaOrdenacaoDuplas,
  direcao: DirecaoOrdenacao,
): number {
  const fator = direcao === "asc" ? 1 : -1;
  const nomeA = `${a.jogador_a_nome} ${a.jogador_b_nome}`.toLowerCase();
  const nomeB = `${b.jogador_a_nome} ${b.jogador_b_nome}`.toLowerCase();

  if (coluna === "dupla") {
    const cmp = nomeA.localeCompare(nomeB);
    return (cmp !== 0 ? cmp : b.pontos - a.pontos) * fator;
  }

  if (coluna === "pontos") {
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === "partidas") {
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === "percentual") {
    const percA = a.percentual ?? 0;
    const percB = b.percentual ?? 0;
    if (percA !== percB) return (percA - percB) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    if (a.partidas !== b.partidas) return (a.partidas - b.partidas) * fator;
    return nomeA.localeCompare(nomeB);
  }

  if (coluna === "vitorias") {
    if (a.vitorias !== b.vitorias) return (a.vitorias - b.vitorias) * fator;
    if (a.pontos !== b.pontos) return (a.pontos - b.pontos) * fator;
    return nomeA.localeCompare(nomeB);
  }

  return 0;
}

export function EstatisticasRacha() {
  const [pares, setPares] = useState<ParRacha[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [colunaOrdenacao, setColunaOrdenacao] =
    useState<ColunaOrdenacaoDuplas>("pontos");
  const [direcaoOrdenacao, setDirecaoOrdenacao] =
    useState<DirecaoOrdenacao>("desc");

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: ["/estatisticas/jogador", "/estatisticas/racha"],
    activeTab: "/estatisticas/racha",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await carregarParesRacha(MIN_PARTIDAS);
      setPares(dados);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function selecionarOrdenacao(coluna: ColunaOrdenacaoDuplas) {
    if (coluna === colunaOrdenacao) {
      setDirecaoOrdenacao((direcao) => (direcao === "asc" ? "desc" : "asc"));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao(coluna === "dupla" ? "asc" : "desc");
  }

  if (erro) {
    return (
      <MensagemEstado tipo="erro">Falha ao carregar: {erro}</MensagemEstado>
    );
  }
  if (carregando && pares === null) {
    return <SkeletonEstatisticas />;
  }

  const paresOrdenados = pares
    ? [...pares].sort((a, b) =>
        compararPares(a, b, colunaOrdenacao, direcaoOrdenacao),
      )
    : [];

  const paresMelhorPior = pares
    ? [...pares].sort((a, b) =>
        compararPares(
          a,
          b,
          colunaOrdenacao === "dupla" ? "pontos" : colunaOrdenacao,
          "desc",
        ),
      )
    : [];

  const melhor = paresMelhorPior[0] ?? null;
  const pior =
    paresMelhorPior.length > 1
      ? paresMelhorPior[paresMelhorPior.length - 1] ?? null
      : null;

  return (
    <PullToRefresh onRefresh={carregar}>
      <div
        className="mx-auto w-full max-w-2xl space-y-6 px-3 py-4 pb-20 sm:px-4 touch-pan-y"
        {...swipeHandlers}
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Estatísticas · Racha
        </h2>

        <div className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
          <NavLink
            to="/estatisticas/jogador"
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
                isActive
                  ? "bg-destaque text-white"
                  : "text-neutral-600 dark:text-neutral-400"
              }`
            }
          >
            Jogador
          </NavLink>
          <NavLink
            to="/estatisticas/racha"
            className={({ isActive }) =>
              `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
                isActive
                  ? "bg-destaque text-white"
                  : "text-neutral-600 dark:text-neutral-400"
              }`
            }
          >
            Racha
          </NavLink>
        </div>

        {/* Secao extensível: próximas estatísticas (sequências, coeficientes, etc.)
            entram como novos <SecaoRacha titulo="...">. */}
        <SecaoRacha
          titulo="Duplas"
          nota={`Consideramos apenas duplas com pelo menos ${MIN_PARTIDAS} partidas juntos.`}
        >
          {paresOrdenados.length === 0 ? (
            <MensagemEstado tipo="info">
              Ainda não há duplas com {MIN_PARTIDAS}+ partidas.
            </MensagemEstado>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <DuplaCard
                  titulo="Melhor dupla"
                  par={melhor}
                  metrica={colunaOrdenacao}
                />
                <DuplaCard
                  titulo="Pior dupla"
                  par={pior}
                  metrica={colunaOrdenacao}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Ranking de Duplas ({paresOrdenados.length})
                  </p>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    Clique no cabeçalho para ordenar
                  </span>
                </div>
                <TabelaDuplas
                  pares={paresOrdenados}
                  colunaOrdenacao={colunaOrdenacao}
                  direcaoOrdenacao={direcaoOrdenacao}
                  onOrdenar={selecionarOrdenacao}
                />
              </div>
            </div>
          )}
        </SecaoRacha>
      </div>
    </PullToRefresh>
  );
}

interface TabelaDuplasProps {
  pares: ParRacha[];
  colunaOrdenacao: ColunaOrdenacaoDuplas;
  direcaoOrdenacao: DirecaoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenacaoDuplas) => void;
}

function TabelaDuplas({
  pares,
  colunaOrdenacao,
  direcaoOrdenacao,
  onOrdenar,
}: TabelaDuplasProps) {
  function renderIndicador(coluna: ColunaOrdenacaoDuplas) {
    if (colunaOrdenacao !== coluna) {
      return (
        <ArrowUpDown className="w-3 h-3 text-neutral-400 dark:text-neutral-500 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
      );
    }
    return direcaoOrdenacao === "asc" ? (
      <ArrowUp className="w-3 h-3 text-destaque shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-destaque shrink-0" />
    );
  }

  function renderTh(
    coluna: ColunaOrdenacaoDuplas,
    label: string,
    align: "left" | "center" | "right" = "center",
  ) {
    const ativa = colunaOrdenacao === coluna;
    const justifyClass =
      align === "left"
        ? "justify-start"
        : align === "right"
          ? "justify-end ml-auto"
          : "justify-center mx-auto";

    return (
      <th
        scope="col"
        aria-sort={
          ativa
            ? direcaoOrdenacao === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`px-3 py-2 ${
          align === "left"
            ? "text-left"
            : align === "right"
              ? "text-right"
              : "text-center"
        }`}
      >
        <button
          type="button"
          onClick={() => onOrdenar(coluna)}
          className={`group inline-flex items-center gap-1 font-bold uppercase transition-colors cursor-pointer select-none ${justifyClass} ${
            ativa
              ? "text-destaque font-extrabold"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
          title={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          {renderIndicador(coluna)}
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60 shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-neutral-200 bg-neutral-50/80 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-center w-8">
              #
            </th>
            {renderTh("dupla", "Dupla", "left")}
            {renderTh("pontos", "Pts", "center")}
            {renderTh("partidas", "J", "center")}
            {renderTh("vitorias", "V/E/D", "center")}
            {renderTh("percentual", "%", "right")}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
          {pares.map((par, i) => (
            <tr
              key={`${par.jogador_a_id}-${par.jogador_b_id}`}
              className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
            >
              <td className="px-3 py-2.5 text-center font-medium text-neutral-400 dark:text-neutral-500 text-[11px]">
                {i + 1}
              </td>
              <td className="px-3 py-2.5 font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5 shrink-0">
                    <Avatar nome={par.jogador_a_nome} size="xs" />
                    <Avatar nome={par.jogador_b_nome} size="xs" />
                  </div>
                  <span>
                    {par.jogador_a_nome} + {par.jogador_b_nome}
                  </span>
                </div>
              </td>
              <td
                className={`px-3 py-2.5 text-center font-extrabold ${
                  colunaOrdenacao === "pontos"
                    ? "text-destaque font-black"
                    : "text-destaque"
                }`}
              >
                {par.pontos}
              </td>
              <td
                className={`px-3 py-2.5 text-center ${
                  colunaOrdenacao === "partidas"
                    ? "font-bold text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                {par.partidas}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-[11px] whitespace-nowrap ${
                  colunaOrdenacao === "vitorias"
                    ? "font-bold text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {par.vitorias}V {par.empates}E {par.derrotas}D
              </td>
              <td
                className={`px-3 py-2.5 text-right font-semibold ${
                  colunaOrdenacao === "percentual"
                    ? "font-bold text-destaque"
                    : "text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {par.percentual === null
                  ? "—"
                  : `${Math.round(par.percentual * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
