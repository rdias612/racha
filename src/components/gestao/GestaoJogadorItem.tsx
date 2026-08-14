import React from "react";
import { Check, Crown, Shield, UserCheck2, Sparkles } from "lucide-react";
import { Avatar } from "../Avatar";
import { isSuperAdmin, MAX_MENSALISTAS, type JogadorLista } from "../../lib/jogadores";
import { POSICOES } from "../../lib/times";

interface GestaoJogadorItemProps {
  jogador: JogadorLista;
  jogadorOriginal: JogadorLista;
  modificado: boolean;
  limiteAtingido: boolean;
  salvandoLote: boolean;
  onAlternarMensalista: (j: JogadorLista) => void;
  onAlternarAdmin: (j: JogadorLista) => void;
}

export const GestaoJogadorItem = React.memo(function GestaoJogadorItem({
  jogador,
  jogadorOriginal,
  modificado,
  limiteAtingido,
  salvandoLote,
  onAlternarMensalista,
  onAlternarAdmin,
}: GestaoJogadorItemProps) {
  const superadmin = isSuperAdmin(jogador.username);
  const bloqMensalista = !jogador.is_mensalista && limiteAtingido;

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-neutral-900/80 p-3.5 shadow-xs space-y-3 transition ${
        modificado
          ? "border-green-500 dark:border-green-500/80 ring-2 ring-green-500/20 dark:ring-green-500/30"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      {/* Linha Superior: Dados do Jogador */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar nome={jogador.nome} posicao={jogador.posicao} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                {jogador.nome}
              </span>

              {modificado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300 animate-pulse shrink-0">
                  <Sparkles className="w-3 h-3 text-green-600 dark:text-green-400" />
                  Pendente
                </span>
              )}

              {superadmin && (
                <span
                  title="Superadmin permanente"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0"
                >
                  <Crown className="w-3 h-3 text-amber-500" />
                  Superadmin
                </span>
              )}
              {!superadmin && jogador.is_admin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                  <Shield className="w-3 h-3 text-blue-500" />
                  Admin
                </span>
              )}
              {jogador.is_mensalista ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                  <UserCheck2 className="w-3 h-3 text-emerald-500" />
                  Mensalista
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                  Avulso
                </span>
              )}
            </div>

            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              @{jogador.username} · {POSICOES[jogador.posicao]}
              {jogador.posicao_b && ` / 2ª ${POSICOES[jogador.posicao_b]}`}
            </div>
          </div>
        </div>
      </div>

      {/* Linha Inferior: Controles de Gestão */}
      <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Toggle Mensalista */}
        <button
          type="button"
          disabled={salvandoLote}
          onClick={() => onAlternarMensalista(jogadorOriginal)}
          title={
            bloqMensalista
              ? `Limite de ${MAX_MENSALISTAS} mensalistas atingido`
              : undefined
          }
          className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
            jogador.is_mensalista
              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40"
              : bloqMensalista
              ? "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 opacity-80"
              : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                jogador.is_mensalista
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : bloqMensalista
                  ? "border-amber-400 bg-amber-100 dark:bg-amber-950"
                  : "border-neutral-400 bg-white dark:bg-neutral-900"
              }`}
            >
              {jogador.is_mensalista && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <span className="font-semibold">Mensalista</span>
          </div>

          <span className="text-[11px] font-medium opacity-80">
            {jogador.is_mensalista
              ? "Ativo"
              : bloqMensalista
              ? `Lotado (${MAX_MENSALISTAS}/${MAX_MENSALISTAS})`
              : "Tornar Mensalista"}
          </span>
        </button>

        {/* Toggle Admin */}
        <button
          type="button"
          disabled={salvandoLote || superadmin}
          onClick={() => onAlternarAdmin(jogadorOriginal)}
          title={
            superadmin
              ? "Superadmin permanente (acesso não pode ser removido)"
              : !jogador.is_mensalista
              ? "Apenas jogadores mensalistas podem ser administradores"
              : undefined
          }
          className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
            superadmin
              ? "border-amber-300/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 opacity-90 cursor-not-allowed"
              : jogador.is_admin
              ? "border-blue-300 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 hover:bg-blue-100/60 dark:hover:bg-blue-950/40"
              : !jogador.is_mensalista
              ? "border-neutral-200/80 bg-neutral-100/60 dark:border-neutral-800/50 dark:bg-neutral-900/40 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/90 dark:hover:bg-neutral-800/40"
              : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                superadmin
                  ? "bg-amber-500 border-amber-500 text-white"
                  : jogador.is_admin
                  ? "bg-blue-600 border-blue-600 text-white"
                  : !jogador.is_mensalista
                  ? "border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                  : "border-neutral-400 bg-white dark:bg-neutral-900"
              }`}
            >
              {(superadmin || jogador.is_admin) && (
                <Check className="w-3 h-3 stroke-[3]" />
              )}
            </div>
            <span className="font-semibold">Administrador</span>
          </div>

          <span className="text-[11px] font-medium opacity-80 flex items-center gap-1">
            {superadmin ? (
              <>
                <Crown className="w-3 h-3 text-amber-500" />
                <span>Superadmin Fixado</span>
              </>
            ) : jogador.is_admin ? (
              "Ativo"
            ) : !jogador.is_mensalista ? (
              "Requer Mensalista"
            ) : (
              "Tornar Admin"
            )}
          </span>
        </button>
      </div>
    </div>
  );
});
