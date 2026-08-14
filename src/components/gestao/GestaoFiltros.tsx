import React from "react";
import { Search, X } from "lucide-react";
import { MAX_MENSALISTAS } from "../../lib/jogadores";
import type { FiltroTipo } from "../../hooks/useGestaoJogadores";

interface GestaoFiltrosProps {
  busca: string;
  onBuscaChange: (termo: string) => void;
  filtro: FiltroTipo;
  onFiltroChange: (filtro: FiltroTipo) => void;
  totalJogadores: number;
  totalMensalistas: number;
  totalAdmins: number;
}

export const GestaoFiltros = React.memo(function GestaoFiltros({
  busca,
  onBuscaChange,
  filtro,
  onFiltroChange,
  totalJogadores,
  totalMensalistas,
  totalAdmins,
}: GestaoFiltrosProps) {
  const totalAvulsos = totalJogadores - totalMensalistas;

  return (
    <div className="space-y-2.5">
      {/* Campo de Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar por nome ou @usuário..."
          className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
        />
        {busca && (
          <button
            type="button"
            onClick={() => onBuscaChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            aria-label="Limpar busca"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Abas de filtro */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => onFiltroChange("todos")}
          className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
            filtro === "todos"
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          }`}
        >
          Todos ({totalJogadores})
        </button>
        <button
          type="button"
          onClick={() => onFiltroChange("mensalistas")}
          className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
            filtro === "mensalistas"
              ? "bg-emerald-600 text-white dark:bg-emerald-500"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          }`}
        >
          Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})
        </button>
        <button
          type="button"
          onClick={() => onFiltroChange("avulsos")}
          className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
            filtro === "avulsos"
              ? "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          }`}
        >
          Avulsos ({totalAvulsos})
        </button>
        <button
          type="button"
          onClick={() => onFiltroChange("admins")}
          className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
            filtro === "admins"
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          }`}
        >
          Admins ({totalAdmins})
        </button>
      </div>
    </div>
  );
});
