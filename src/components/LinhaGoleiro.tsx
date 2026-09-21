import {
  Phone,
  CreditCard,
  Copy,
  Check,
  Edit2,
  Save,
  X,
  Power,
  Shield,
} from 'lucide-react';
import type { JogadorLista } from '../lib/jogadores';

interface LinhaGoleiroProps {
  goleiro: JogadorLista;
  estaEditando: boolean;
  editTelefone: string;
  editChavePix: string;
  salvando: boolean;
  foiCopiado: boolean;
  aoMudarTelefone: (valor: string) => void;
  aoMudarChavePix: (valor: string) => void;
  aoIniciarEdicao: (goleiro: JogadorLista) => void;
  aoSalvarEdicao: (id: number) => void;
  aoCancelarEdicao: () => void;
  aoCopiarPix: (id: number, pix: string) => void;
  aoPedirAlternanciaStatus: (goleiro: JogadorLista) => void;
}

/** Uma linha da listagem contínua de goleiros: modo leitura e edição inline. */
export function LinhaGoleiro({
  goleiro,
  estaEditando,
  editTelefone,
  editChavePix,
  salvando,
  foiCopiado,
  aoMudarTelefone,
  aoMudarChavePix,
  aoIniciarEdicao,
  aoSalvarEdicao,
  aoCancelarEdicao,
  aoCopiarPix,
  aoPedirAlternanciaStatus,
}: LinhaGoleiroProps) {
  const g = goleiro;
  const temTel = Boolean(g.telefone?.trim());
  const temPix = Boolean(g.chave_pix?.trim());
  const zapLink = temTel ? `https://wa.me/55${g.telefone?.replace(/\D/g, '')}` : null;

  return (
    <div
      className={`p-3.5 transition ${
        g.is_ativo ? 'bg-superficie hover:bg-superficie-2/50' : 'bg-superficie/40 opacity-70'
      }`}
    >
      {/* Linha Principal do Goleiro */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-lg shrink-0 mt-0.5" role="img" aria-label="Goleiro">
            🧤
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base uppercase tracking-wider text-giz truncate">
                {g.username}
              </h3>
              <span
                className={`inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-[2px] border ${
                  g.is_ativo ? 'bg-ok/15 text-ok border-ok/40' : 'bg-perigo/15 text-perigo border-perigo/40'
                }`}
              >
                {g.is_ativo ? 'Ativo' : 'Inativo'}
              </span>
              {g.is_admin && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono uppercase rounded-[2px] bg-superficie-2 border border-destaque/50 text-destaque-texto">
                  <Shield className="size-2.5" />
                  Admin
                </span>
              )}
              {g.posicao_b && (
                <span className="text-[11px] font-mono text-giz-fraco">
                  (Linha: {g.posicao_b})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações com Alvos Mínimos de 44px */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!estaEditando ? (
            <>
              <button
                type="button"
                onClick={() => aoIniciarEdicao(g)}
                title="Editar dados"
                aria-label={`Editar dados de ${g.username}`}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque active:translate-y-px transition flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque-texto"
              >
                <Edit2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => aoPedirAlternanciaStatus(g)}
                title={g.is_ativo ? 'Desativar goleiro' : 'Ativar goleiro'}
                aria-label={`${g.is_ativo ? 'Desativar' : 'Ativar'} ${g.username}`}
                className={`min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] border active:translate-y-px transition flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque-texto ${
                  g.is_ativo
                    ? 'border-borda bg-superficie-2 text-giz-fraco hover:text-perigo hover:border-perigo'
                    : 'border-ok/40 bg-ok/15 text-ok hover:bg-ok/25'
                }`}
              >
                <Power className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => aoSalvarEdicao(g.id)}
                disabled={salvando}
                title="Salvar alterações"
                aria-label="Salvar alterações"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] bg-destaque text-destaque-tinta font-bold shadow-carimbo hover:brightness-105 active:translate-y-px transition flex items-center justify-center disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-destaque-texto"
              >
                <Save className="size-4" />
              </button>
              <button
                type="button"
                onClick={aoCancelarEdicao}
                disabled={salvando}
                title="Cancelar edição"
                aria-label="Cancelar edição"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz active:translate-y-px transition flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque-texto"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Corpo: Visualização ou Formulário de Edição Inline */}
      {estaEditando ? (
        <div className="mt-3 pt-3 border-t border-borda space-y-3">
          <div>
            <label className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="tel"
              value={editTelefone}
              onChange={(e) => aoMudarTelefone(e.target.value)}
              placeholder="ex.: (21) 99999-9999"
              className="w-full px-3 py-2 rounded-[4px] border border-borda bg-superficie-2 text-base sm:text-sm font-mono text-giz focus-visible:outline-2 focus-visible:outline-destaque-texto min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              Chave PIX
            </label>
            <input
              type="text"
              value={editChavePix}
              onChange={(e) => aoMudarChavePix(e.target.value)}
              placeholder="ex.: CPF, e-mail, telefone ou chave aleatória"
              className="w-full px-3 py-2 rounded-[4px] border border-borda bg-superficie-2 text-base sm:text-sm font-mono text-giz focus-visible:outline-2 focus-visible:outline-destaque-texto min-h-[44px]"
            />
          </div>
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          {/* Telefone */}
          <div className="flex items-center gap-2 text-giz-fraco min-h-[44px]">
            <Phone className="size-3.5 shrink-0 text-destaque-texto" />
            {temTel ? (
              zapLink ? (
                <a
                  href={zapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-destaque-texto hover:underline py-1 inline-flex items-center gap-1 min-h-[44px]"
                >
                  <span>{g.telefone}</span>
                  <span className="text-[10px]">↗</span>
                </a>
              ) : (
                <span className="text-giz">{g.telefone}</span>
              )
            ) : (
              <span className="italic text-giz-fraco/70">Sem telefone</span>
            )}
          </div>

          {/* Chave PIX */}
          <div className="flex items-center justify-between gap-2 text-giz-fraco min-h-[44px]">
            <div className="flex items-center gap-2 truncate">
              <CreditCard className="size-3.5 shrink-0 text-destaque-texto" />
              {temPix ? (
                <span className="truncate text-giz" title={g.chave_pix ?? ''}>
                  {g.chave_pix}
                </span>
              ) : (
                <span className="italic text-giz-fraco/70">Sem chave PIX</span>
              )}
            </div>

            {temPix && (
              <button
                type="button"
                onClick={() => aoCopiarPix(g.id, g.chave_pix!)}
                title="Copiar Chave PIX"
                aria-label={`Copiar Chave PIX de ${g.username}`}
                className="shrink-0 min-h-[44px] px-2.5 rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque active:translate-y-px transition flex items-center gap-1.5 text-xs font-mono focus-visible:outline-2 focus-visible:outline-destaque-texto"
              >
                {foiCopiado ? (
                  <>
                    <Check className="size-3.5 text-ok" />
                    <span className="text-ok font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
