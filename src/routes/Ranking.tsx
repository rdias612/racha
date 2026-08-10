import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Metrica = "pontos" | "gols" | "assistencias" | "gols-contra";

const metricas: Record<
  Metrica,
  { titulo: string; coluna: string; campo: keyof LinhaRanking }
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

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from("ranking")
        .select(
          "jogador_id, nome, pontos, vitorias, empates, derrotas, partidas, gols, assistencias, gols_contra",
        )
        .order("pontos", { ascending: false })
        .order("vitorias", { ascending: false })
        .order("partidas", { ascending: false })
        .order("gols", { ascending: false })
        .order("assistencias", { ascending: false })
        .order("nome", { ascending: true });

      if (error) {
        setErro(error.message);
      } else {
        setLinhas(data ?? []);
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  if (carregando)
    return (
      <div className="p-4 text-sm text-neutral-500">Carregando ranking…</div>
    );
  if (erro) return <div className="p-4 text-sm text-red-600">{erro}</div>;

  const linhasOrdenadas = [...linhas].sort((a, b) => {
    const diferenca =
      Number(b[configuracao.campo]) - Number(a[configuracao.campo]);
    return diferenca || a.nome.localeCompare(b.nome);
  });

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
        {configuracao.titulo}
      </h2>

      {linhasOrdenadas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma partida publicada ainda. O ranking aparece quando houver
          partidas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-8">#</th>
                <th className="px-2 py-2 text-left font-medium">Nome</th>
                <th className="px-2 py-2 text-right font-medium">
                  {configuracao.coluna}
                </th>
                <th className="px-2 py-2 text-right font-medium">% vitórias</th>
                <th className="px-2 py-2 text-right font-medium">Partidas</th>
                <th className="px-2 py-2 text-right font-medium">Vitórias</th>
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
                    <td className="px-2 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                      {l.nome}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l[configuracao.campo]}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.partidas > 0
                        ? `${Math.round((l.vitorias / l.partidas) * 100)}%`
                        : "0%"}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.partidas}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.vitorias}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
        Ordenação: {configuracao.coluna.toLowerCase()} do maior para o menor,
        com desempate alfabético.
      </p>
    </div>
  );
}
