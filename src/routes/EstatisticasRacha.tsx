import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { MensagemEstado } from "../components/Estado";
import { SkeletonEstatisticas } from "../components/Skeletons";
import { useSwipeTabs } from "../hooks/useSwipeTabs";
import { DuplaCard } from "../components/DuplaCard";
import { SecaoRacha } from "../components/SecaoRacha";
import { Avatar } from "../components/Avatar";
import { carregarParesRacha, type ParRacha } from "../lib/partidas";

const MIN_PARTIDAS = 5;
const ESTATISTICAS_TABS = ["/estatisticas/jogador", "/estatisticas/racha"];

export function EstatisticasRacha() {
  const swipeHandlers = useSwipeTabs({
    tabs: ESTATISTICAS_TABS,
    activeTab: "/estatisticas/racha",
  });
  const [pares, setPares] = useState<ParRacha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setPares(null);
    setErro(null);
    carregarParesRacha(MIN_PARTIDAS)
      .then((dados) => {
        if (!cancelado) setPares(dados);
      })
      .catch((e: unknown) => {
        if (!cancelado)
          setErro(e instanceof Error ? e.message : "Erro ao carregar dados.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (erro) {
    return (
      <MensagemEstado tipo="erro">Falha ao carregar: {erro}</MensagemEstado>
    );
  }
  if (pares === null) {
    return <SkeletonEstatisticas />;
  }

  const melhor = pares[0] ?? null;
  const pior = pares.length > 1 ? pares[pares.length - 1] : null;

  return (
    <div
      {...swipeHandlers}
      className="mx-auto w-full max-w-2xl space-y-6 px-3 py-4 sm:px-4 animate-page-enter"
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
                ? "bg-(--cor-destaque) text-white"
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
                ? "bg-(--cor-destaque) text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`
          }
        >
          Racha
        </NavLink>
      </div>

      {/* Secao extensível: próximas estatísticas (sequências, coeficientes, etc.)
          entram como novos <SecaoRacha titulo="...">. */}
      <SecaoRacha titulo="Duplas">
        {pares.length === 0 ? (
          <MensagemEstado tipo="info">
            Ainda não há duplas com {MIN_PARTIDAS}+ partidas.
          </MensagemEstado>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <DuplaCard titulo="Melhor dupla" par={melhor} />
              <DuplaCard titulo="Pior dupla" par={pior} />
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Top 5
              </p>
              <TabelaDuplas pares={pares.slice(0, 5)} inicio={1} />
            </div>

            {pares.length > 5 && (
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Bottom 5
                </p>
                <TabelaDuplas
                  pares={pares.slice(-5).reverse()}
                  inicio={1}
                />
              </div>
            )}
          </div>
        )}
      </SecaoRacha>
    </div>
  );
}

function TabelaDuplas({ pares, inicio }: { pares: ParRacha[]; inicio: number }) {
  return (
    <div
      data-no-swipe
      className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60 shadow-xs"
    >
      <table className="w-full text-left text-xs">
        <thead className="border-b border-neutral-200 bg-neutral-50/80 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-center w-8">#</th>
            <th scope="col" className="px-3 py-2">Dupla</th>
            <th scope="col" className="px-3 py-2 text-center">Pts</th>
            <th scope="col" className="px-3 py-2 text-center">J</th>
            <th scope="col" className="px-3 py-2 text-center">V/E/D</th>
            <th scope="col" className="px-3 py-2 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
          {pares.map((par, i) => (
            <tr
              key={`${par.jogador_a_id}-${par.jogador_b_id}`}
              className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
            >
              <td className="px-3 py-2.5 text-center font-medium text-neutral-400 dark:text-neutral-500 text-[11px]">
                {inicio + i}
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
              <td className="px-3 py-2.5 text-center font-extrabold text-(--cor-destaque)">
                {par.pontos}
              </td>
              <td className="px-3 py-2.5 text-center text-neutral-600 dark:text-neutral-400">
                {par.partidas}
              </td>
              <td className="px-3 py-2.5 text-center text-neutral-500 dark:text-neutral-400 text-[11px] whitespace-nowrap">
                {par.vitorias}V {par.empates}E {par.derrotas}D
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-neutral-700 dark:text-neutral-300">
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
