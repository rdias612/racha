import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { POSICOES, type PosicaoId } from "../lib/times";
import { Carregando, MensagemEstado } from "../components/Estado";

type Metrica = "pontos" | "gols" | "assistencias" | "gols-contra";
type CampoMetrica = "pontos" | "gols" | "assistencias" | "gols_contra";
type ColunaOrdenacao =
  | "nome"
  | CampoMetrica
  | "percentual_vitorias"
  | "partidas"
  | "vitorias"
  | "derrotas";
type DirecaoOrdenacao = "asc" | "desc";

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

  if (carregando) return <Carregando>Carregando ranking</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );

  function valorOrdenacao(linha: LinhaRanking, coluna: ColunaOrdenacao) {
    if (coluna === "nome") return linha.nome;
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

  const colunasOrdenacao: { key: ColunaOrdenacao; label: string }[] = [
    { key: "nome", label: "Nome" },
    { key: configuracao.campo, label: configuracao.coluna },
    { key: "percentual_vitorias", label: "% vitórias" },
    { key: "partidas", label: "Partidas" },
    { key: "vitorias", label: "Vitórias" },
    { key: "derrotas", label: "Derrotas" },
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

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
        {configuracao.titulo}
      </h2>

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

      {linhasOrdenadas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma partida publicada ainda. O ranking aparece quando houver
          partidas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-8">#</th>
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
                      className={`px-2 py-2 font-medium ${
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
              {linhasOrdenadas.map((l, i) => {
                const primeiro = i === 0;
                return (
                  <tr
                    key={l.jogador_id}
                    className={
                      primeiro
                        ? "bg-(--cor-destaque)/10"
                        : "bg-white dark:bg-neutral-950"
                    }
                  >
                    <td className="px-2 py-2 text-neutral-500 dark:text-neutral-400">
                      {primeiro ? "🏆" : i + 1}
                    </td>
                    {colunasOrdenacao.map((coluna) => (
                      <td
                        key={coluna.key}
                        className={`px-2 py-2 text-neutral-600 dark:text-neutral-400 ${
                          coluna.key === "nome"
                            ? "whitespace-nowrap"
                            : "text-right"
                        }`}
                      >
                        {coluna.key === "nome"
                          ? l.nome
                          : coluna.key === "percentual_vitorias"
                            ? `${Math.round(
                                Number(valorOrdenacao(l, coluna.key)) * 100,
                              )}%`
                            : l[coluna.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
