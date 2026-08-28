import { Check, Crown, KeyRound, Shield, Sparkles, UserCheck2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { isSuperAdminId, MAX_MENSALISTAS, type JogadorLista } from '../lib/jogadores';
import { POSICOES } from '../lib/times';

export interface LinhaJogadorGestaoProps {
  /** Estado de rascunho (original mesclado com alterações pendentes) */
  jogador: JogadorLista;
  /** Estado original vindo do servidor, sem mesclagem */
  jogadorOriginal: JogadorLista;
  /** Boolean(rascunhos[jogador.id]) — calculado pela rota */
  modificado: boolean;
  limiteAtingido: boolean;
  salvandoLote: boolean;
  resetandoId: number | null;
  onAlternarMensalista: (j: JogadorLista) => void;
  onAlternarAdmin: (j: JogadorLista) => void;
  onSolicitarResetSenha: (j: JogadorLista) => void;
}

export function LinhaJogadorGestao({
  jogador: j,
  jogadorOriginal,
  modificado,
  limiteAtingido,
  salvandoLote,
  resetandoId,
  onAlternarMensalista,
  onAlternarAdmin,
  onSolicitarResetSenha,
}: LinhaJogadorGestaoProps) {
  const superadmin = isSuperAdminId(j.id);
  const bloqMensalista = !j.is_mensalista && limiteAtingido;

  return (
    <div
      className={`rounded-[4px] border bg-superficie p-3.5 shadow-carimbo space-y-3 transition ${
        modificado ? 'border-destaque ring-2 ring-destaque/30' : 'border-borda'
      }`}
    >
      {/* Linha Superior: Dados do Jogador */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar username={j.username} posicao={j.posicao} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-bold text-sm uppercase tracking-wide text-giz truncate">
                @{j.username}
              </span>

              {modificado && (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-destaque/20 border border-destaque/50 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-destaque-texto animate-pulse shrink-0">
                  <Sparkles className="size-3 text-destaque-texto" />
                  Pendente
                </span>
              )}

              {superadmin && (
                <span
                  title="Superadmin permanente"
                  className="inline-flex items-center gap-1 rounded-[2px] bg-destaque text-destaque-tinta px-1.5 py-0.5 text-[9px] font-display font-black uppercase tracking-wider shadow-xs shrink-0"
                >
                  <Crown className="size-3" />
                  Superadmin
                </span>
              )}
              {!superadmin && j.is_admin && (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-superficie-2 border border-destaque/50 text-destaque-texto px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider shrink-0">
                  <Shield className="size-3" />
                  Admin
                </span>
              )}
              {j.posicao === 'goleiro' ? (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/15 border border-ok/40 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-ok shrink-0">
                  🧤 Isento (Goleiro)
                </span>
              ) : j.is_mensalista ? (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/15 border border-ok/40 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-ok shrink-0">
                  <UserCheck2 className="size-3 text-ok" />
                  Mensalista
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-superficie-2 border border-borda px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-giz-fraco shrink-0">
                  Avulso
                </span>
              )}
            </div>

            <div className="text-xs font-mono text-giz-fraco truncate mt-0.5">
              {POSICOES[j.posicao]}
              {j.posicao_b && ` / 2ª ${POSICOES[j.posicao_b]}`}
            </div>
          </div>
        </div>
      </div>

      {/* Linha Inferior: Controles de Gestão */}
      <div className="pt-2.5 border-t border-borda grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Toggle Mensalista */}
        <button
          type="button"
          disabled={salvandoLote || j.posicao === 'goleiro'}
          onClick={() => onAlternarMensalista(jogadorOriginal)}
          title={
            j.posicao === 'goleiro'
              ? 'Goleiros não pagam para jogar (isentos de mensalidade)'
              : bloqMensalista
                ? `Limite de ${MAX_MENSALISTAS} mensalistas atingido`
                : undefined
          }
          className={`flex items-center justify-between p-2.5 rounded-[3px] border transition min-h-[44px] ${
            j.posicao === 'goleiro'
              ? 'border-borda bg-superficie-2 text-giz-fraco/50 cursor-not-allowed'
              : j.is_mensalista
                ? 'border-ok/60 bg-ok/10 text-ok hover:bg-ok/20'
                : bloqMensalista
                  ? 'border-borda bg-superficie-2 text-giz-fraco opacity-60'
                  : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`size-4 rounded-[2px] flex items-center justify-center border transition ${
                j.is_mensalista ? 'bg-ok border-ok text-branco-time' : 'border-borda bg-superficie'
              }`}
            >
              {j.is_mensalista && <Check className="size-3 stroke-[3]" />}
            </div>
            <span className="font-display font-bold uppercase tracking-wider">Mensalista</span>
          </div>

          <span className="text-[10px] font-mono opacity-80">
            {j.posicao === 'goleiro'
              ? 'Isento (Goleiro)'
              : j.is_mensalista
                ? 'Ativo'
                : bloqMensalista
                  ? `Lotado (${MAX_MENSALISTAS})`
                  : 'Tornar Mensalista'}
          </span>
        </button>

        {/* Toggle Admin */}
        <button
          type="button"
          disabled={salvandoLote || superadmin}
          onClick={() => onAlternarAdmin(jogadorOriginal)}
          title={
            superadmin
              ? 'Superadmin permanente (acesso não pode ser removido)'
              : !j.is_mensalista
                ? 'Apenas jogadores mensalistas podem ser administradores'
                : undefined
          }
          className={`flex items-center justify-between p-2.5 rounded-[3px] border transition min-h-[44px] ${
            superadmin
              ? 'border-destaque/60 bg-destaque/15 text-destaque-texto cursor-not-allowed'
              : j.is_admin
                ? 'border-destaque/60 bg-destaque/10 text-destaque-texto hover:bg-destaque/20'
                : !j.is_mensalista
                  ? 'border-borda bg-superficie-2 text-giz-fraco/50'
                  : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`size-4 rounded-[2px] flex items-center justify-center border transition ${
                superadmin
                  ? 'bg-destaque border-destaque text-destaque-tinta'
                  : j.is_admin
                    ? 'bg-destaque border-destaque text-destaque-tinta'
                    : 'border-borda bg-superficie'
              }`}
            >
              {(superadmin || j.is_admin) && <Check className="size-3 stroke-[3]" />}
            </div>
            <span className="font-display font-bold uppercase tracking-wider">Administrador</span>
          </div>

          <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
            {superadmin ? (
              <>
                <Crown className="size-3 text-destaque-texto" />
                <span>Superadmin</span>
              </>
            ) : j.is_admin ? (
              'Ativo'
            ) : !j.is_mensalista ? (
              'Requer Mensalista'
            ) : (
              'Tornar Admin'
            )}
          </span>
        </button>

        {/* Ações: Resetar Senha */}
        {!superadmin && (
          <button
            type="button"
            disabled={resetandoId !== null}
            onClick={() => onSolicitarResetSenha(jogadorOriginal)}
            title="Redefinir a senha para o padrão 123"
            className="flex items-center justify-between p-2.5 rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-borda transition disabled:opacity-50 min-h-[44px] sm:col-span-2"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-giz-fraco" />
              <span className="font-display font-bold uppercase tracking-wider">Resetar Senha</span>
            </div>

            <span className="text-[10px] font-mono opacity-80">
              {resetandoId === j.id ? 'Resetando...' : 'Padrão "123"'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
