import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Carregando, MensagemEstado } from "../components/Estado";
import { DuplaCard } from "../components/DuplaCard";
import { SecaoRacha } from "../components/SecaoRacha";
import { carregarParesRacha, type ParRacha } from "../lib/partidas";

const MIN_PARTIDAS = 5;

export function EstatisticasRacha() {
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
    return <Carregando>Carregando estatísticas do racha…</Carregando>;
  }

  const melhor = pares[0] ?? null;
  const pior = pares.length > 1 ? pares[pares.length - 1] : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-3 py-4 sm:px-4">
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
              <ListaDuplas pares={pares.slice(0, 5)} inicio={1} />
            </div>

            {pares.length > 5 && (
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Bottom 5
                </p>
                <ListaDuplas
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

function ListaDuplas({ pares, inicio }: { pares: ParRacha[]; inicio: number }) {
  return (
    <ol className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
      {pares.map((par, i) => (
        <li
          key={`${par.jogador_a_id}-${par.jogador_b_id}`}
          className="px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-100">
              <span className="w-6 text-right text-xs text-neutral-500 dark:text-neutral-400">
                {inicio + i}
              </span>
              <span className="font-medium">
                {par.jogador_a_nome} + {par.jogador_b_nome}
              </span>
            </span>
            <span className="font-semibold text-(--cor-destaque)">{par.pontos} pts</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {par.partidas}J · {par.vitorias}V · {par.empates}E ·{" "}
              {par.derrotas}D
            </span>
            <span>{par.percentual === null ? "—" : `${Math.round(par.percentual * 100)}%`}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
