import { Crown, Shield, UserCheck, UserCheck2, Users } from 'lucide-react';
import { MAX_MENSALISTAS } from '../lib/jogadores';

export interface ResumoGestaoProps {
  totalJogadores: number;
  totalMensalistas: number;
  totalAdmins: number;
  totalSuperAdmins: number;
}

export function ResumoGestao({
  totalJogadores,
  totalMensalistas,
  totalAdmins,
  totalSuperAdmins,
}: ResumoGestaoProps) {
  const limiteAtingido = totalMensalistas >= MAX_MENSALISTAS;

  return (
    <>
      {limiteAtingido && (
        <div className="rounded-[4px] border border-destaque/50 bg-destaque/10 p-3 text-xs text-giz flex items-start gap-2.5 shadow-carimbo">
          <UserCheck2 className="size-4 text-destaque-texto shrink-0 mt-0.5" />
          <div>
            <span className="font-display font-bold uppercase tracking-wider text-destaque-texto block">
              Limite Máximo Atingido ({MAX_MENSALISTAS}/{MAX_MENSALISTAS} Mensalistas)
            </span>
            <span className="text-giz-fraco text-xs font-mono">
              O limite de {MAX_MENSALISTAS} mensalistas foi alcançado. Para definir um novo
              mensalista, desmarque um mensalista atual.
            </span>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Total Geral
            </span>
            <Users className="size-4 text-destaque-texto" />
          </div>
          <div className="text-2xl font-mono font-black text-giz tabular-nums">
            {totalJogadores}
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-giz-fraco mb-1">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                Mensalistas
              </span>
              <UserCheck className="size-4 text-ok" />
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-ok tabular-nums">{totalMensalistas}</span>
              <span className="text-xs font-bold text-giz-fraco">/ {MAX_MENSALISTAS}</span>
            </div>
          </div>

          <div className="mt-2">
            <div className="h-1.5 w-full bg-superficie-2 border border-borda rounded-[2px] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  limiteAtingido ? 'bg-destaque' : 'bg-ok'
                }`}
                style={{
                  width: `${Math.min(100, (totalMensalistas / MAX_MENSALISTAS) * 100)}%`,
                }}
              />
            </div>
            <div className="text-[9px] font-mono text-giz-fraco mt-1">
              {limiteAtingido
                ? 'Limite lotado'
                : `${MAX_MENSALISTAS - totalMensalistas} vaga(s) livre(s)`}
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Admins
            </span>
            <Shield className="size-4 text-destaque-texto" />
          </div>
          <div className="text-2xl font-mono font-black text-destaque-texto tabular-nums">
            {totalAdmins}
          </div>
        </div>

        <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between text-giz-fraco mb-1">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
              Superadmins
            </span>
            <Crown className="size-4 text-destaque-texto" />
          </div>
          <div className="text-2xl font-mono font-black text-destaque-texto tabular-nums">
            {totalSuperAdmins}
          </div>
        </div>
      </div>
    </>
  );
}
