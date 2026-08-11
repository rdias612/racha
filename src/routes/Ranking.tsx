import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { POSICOES, type PosicaoId } from "../lib/times";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import { Carregando, MensagemEstado } from "../components/Estado";

type Metrica = "pontos" | "gols" | "assistencias" | "gols-contra";
type CampoMetrica = "pontos" | "gols" | "assistencias" | "gols_contra";
type ColunaOrdenacao =
  | "nome"
  | CampoMetrica
  | "media_gols"
  | "percentual_vitorias"
  | "partidas"
  | "vitorias"
  | "empates"
  | "derrotas";
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
};

const rotuloMetricaCurta: Record<CampoMetrica, string> = {
  pontos: "pts",
  gols: "gols",
  assistencias: "assist.",
  gols_contra: "GC",
};

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

export function Ranking() {
  const jogadorLogado = useJogadorLogado();
  const { metrica: parametro } = useParams<{ metrica: Metrica }>();
  const metrica: Metrica =
    parametro && parametro in metricas ? parametro : "pontos";
  const configuracao = metricas[metrica];
  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>(
    configuracao.campo,
  );
  const [direcaoOrdenacao, setDirecaoOrdenacao] =
    useState<DirecaoOrdenacao>("desc");
  const [posicaoFiltro, setPosicaoFiltro] = useState<PosicaoId | "todas">(
    "todas",
  );
  const [minimoPartidas, setMinimoPartidas] = useState(6);

  useEffect(() => {
    setPosicaoFiltro("todas");
  }, [metrica]);

  useEffect(() => {
    async function carregar() {
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
      setCarregando(false);
    }
    carregar();
  }, [posicaoFiltro]);

  useEffect(() => {
    setColunaOrdenacao(configuracao.campo);
    setDirecaoOrdenacao("desc");
  }, [configuracao.campo]);

  const maximoPartidas = Math.max(6, ...linhas.map((linha) => linha.partidas));

  useEffect(() => {
    setMinimoPartidas((minimo) => Math.min(minimo, maximoPartidas));
  }, [maximoPartidas]);

  if (carregando) return <Carregando>Carregando ranking</Carregando>;
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
    return Number(linha[coluna]);
  }

  function selecionarOrdenacao(coluna: ColunaOrdenacao) {
    if (coluna === colunaOrdenacao) {
      setDirecaoOrdenacao((direcao) => (direcao === "asc" ? "desc" : "asc"));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao(coluna === "nome" ? "asc" : "desc");
  }

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

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
        {configuracao.titulo}
      </h2>

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
        <NavLink
          to="/ranking/pontos"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Pontuação
        </NavLink>
        <NavLink
          to="/ranking/gols"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Gols
        </NavLink>
        <NavLink
          to="/ranking/assistencias"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Assistências
        </NavLink>
        <NavLink
          to="/ranking/gols-contra"
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-md px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap ${
              isActive
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Gols contra
        </NavLink>
      </div>

      <div className="mb-3">
        <label htmlFor="filtro-posicao" className="sr-only">
          Filtrar por posição
        </label>
        <select
          id="filtro-posicao"
          value={posicaoFiltro}
          onChange={(e) =>
            setPosicaoFiltro(e.target.value as PosicaoId | "todas")
          }
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
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

      <div className="mb-4">
        <label
          htmlFor="filtro-minimo-partidas"
          className="flex items-center justify-between text-sm text-neutral-700 dark:text-neutral-300"
        >
          <span>Mínimo de partidas</span>
          <strong>{minimoPartidas}</strong>
        </label>
        <input
          id="filtro-minimo-partidas"
          type="range"
          min="1"
          max={maximoPartidas}
          value={minimoPartidas}
          onChange={(e) => setMinimoPartidas(Number(e.target.value))}
          className="w-full accent-(--cor-destaque)"
        />
      </div>

      {linhasFiltradas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {linhas.length === 0
            ? "Nenhuma partida publicada ainda. O ranking aparece quando houver partidas."
            : "Nenhum jogador atende ao mínimo de partidas selecionado."}
        </p>
      ) : (
        <>
          <TabelaRanking
            linhas={linhasFiltradas}
            colunasOrdenacao={colunasOrdenacao}
            colunaOrdenacao={colunaOrdenacao}
            direcaoOrdenacao={direcaoOrdenacao}
            selecionarOrdenacao={selecionarOrdenacao}
            valorOrdenacao={valorOrdenacao}
            jogadorLogadoId={jogadorLogado?.id}
          />
          <CardRanking
            linhas={linhasFiltradas}
            configuracao={configuracao}
            jogadorLogadoId={jogadorLogado?.id}
          />
        </>
      )}
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
  valorOrdenacao: (linha: LinhaRanking, coluna: ColunaOrdenacao) => number | string;
  jogadorLogadoId?: number;
}) {
  return (
    <div className="hidden sm:block overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-120 text-sm">
        <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
          <tr>
            <th className="px-1.5 py-1.5 text-left font-medium w-8">#</th>
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
                  className={`px-1.5 py-1.5 font-medium ${
                    coluna.key === "nome"
                      ? "w-px whitespace-nowrap text-left sm:min-w-48"
                      : "text-right"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selecionarOrdenacao(coluna.key)}
                    className="inline-flex items-center gap-1"
                  >
                    {coluna.label}
                    <span aria-hidden="true">
                      {direcao === "asc"
                        ? "↑"
                        : direcao === "desc"
                          ? "↓"
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
                    : "bg-white dark:bg-neutral-950"
                }
              >
                <td className="px-1.5 py-1.5 text-neutral-500 dark:text-neutral-400">
                  {primeiro ? "🏆" : i + 1}
                </td>
                {colunasOrdenacao.map((coluna) => (
                  <td
                    key={coluna.key}
                    className={`px-1.5 py-1.5 text-neutral-600 dark:text-neutral-400 ${
                      coluna.key === "nome"
                        ? "whitespace-nowrap"
                        : "text-right"
                    }`}
                  >
                    {coluna.key === "nome"
                      ? l.nome
                      : coluna.key === "media_gols"
                        ? numero2casas.format(
                            Number(valorOrdenacao(l, coluna.key)),
                          )
                        : coluna.key === "percentual_vitorias"
                          ? `${Math.round(
                              Number(valorOrdenacao(l, coluna.key)) * 100,
                            )}%`
                          : l[coluna.key as keyof LinhaRanking]}
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

function CardRanking({
  linhas,
  configuracao,
  jogadorLogadoId,
}: {
  linhas: LinhaRanking[];
  configuracao: (typeof metricas)[Metrica];
  jogadorLogadoId?: number;
}) {
  return (
    <div className="block sm:hidden space-y-2">
      {linhas.map((l, i) => {
        const posicao = i + 1;
        const ehLogado = l.jogador_id === jogadorLogadoId;
        const inicial = l.nome.trim().charAt(0).toUpperCase() || "?";
        const corCirculo =
          posicao === 1
            ? "bg-yellow-400 text-neutral-900"
            : posicao === 2
              ? "bg-neutral-400 text-neutral-900"
              : posicao === 3
                ? "bg-amber-700 text-white"
                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200";
        const valorPrincipal = Number(l[configuracao.campo]);
        const rotuloPrincipal = rotuloMetricaCurta[configuracao.campo];
        const percentualVitorias =
          l.partidas > 0 ? Math.round((l.vitorias / l.partidas) * 100) : 0;
        return (
          <div
            key={l.jogador_id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              ehLogado
                ? "border-(--cor-destaque)/40 bg-(--cor-destaque)/10"
                : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${corCirculo}`}
              aria-hidden="true"
            >
              {inicial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {posicao}º
                  </span>{" "}
                  {l.nome}
                </p>
                <p className="shrink-0 text-base font-bold text-(--cor-destaque)">
                  {valorPrincipal}{" "}
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {rotuloPrincipal}
                  </span>
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                {POSICOES[l.posicao] ?? l.posicao} · P {l.partidas} · V{" "}
                {l.vitorias} · E {l.empates} · D {l.derrotas} ·{" "}
                {percentualVitorias}% vit
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
