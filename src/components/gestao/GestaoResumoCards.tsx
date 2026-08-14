import React from "react";
import { Users, Shield, Crown, UserCheck } from "lucide-react";
import { MAX_MENSALISTAS } from "../../lib/jogadores";

interface GestaoResumoCardsProps {
  totalJogadores: number;
  totalMensalistas: number;
  totalAdmins: number;
  totalSuperAdmins: number;
  limiteAtingido: boolean;
}

export const GestaoResumoCards = React.memo(function GestaoResumoCards({
  totalJogadores,
  totalMensalistas,
  totalAdmins,
  totalSuperAdmins,
  limiteAtingido,
}: GestaoResumoCardsProps) {
  const porcentagemMensalistas = Math.min(
    100,
    (totalMensalistas / MAX_MENSALISTAS) * 100
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {/* Total de Jogadores */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Total
          </span>
          <Users className="w-4 h-4 text-neutral-400" />
        </div>
        <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          {totalJogadores}
        </div>
      </div>

      {/* Mensalistas */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Mensalistas
            </span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {totalMensalistas}
            </span>
            <span className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70">
              / {MAX_MENSALISTAS}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <div className="h-1.5 w-full bg-emerald-200/80 dark:bg-emerald-950 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                limiteAtingido ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-400"
              }`}
              style={{ width: `${porcentagemMensalistas}%` }}
            />
          </div>
          <div className="text-[9px] font-medium text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            {limiteAtingido
              ? "Limite lotado"
              : `${MAX_MENSALISTAS - totalMensalistas} vaga(s) livre(s)`}
          </div>
        </div>
      </div>

      {/* Admins */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3 shadow-xs">
        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Admins
          </span>
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
          {totalAdmins}
        </div>
      </div>

      {/* Superadmins */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 shadow-xs">
        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Superadmins
          </span>
          <Crown className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
          {totalSuperAdmins}
        </div>
      </div>
    </div>
  );
});
