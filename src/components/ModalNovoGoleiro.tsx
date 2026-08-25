import { useState, type FormEvent } from 'react';
import { X, UserPlus, Phone, CreditCard } from 'lucide-react';
import { MensagemEstado } from './Estado';

interface ModalNovoGoleiroProps {
  open: boolean;
  onClose: () => void;
  onSalvar: (dados: { nome: string; telefone: string; chave_pix: string }) => Promise<void>;
}

export function ModalNovoGoleiro({ open, onClose, onSalvar }: ModalNovoGoleiroProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro('Informe o nome do goleiro.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await onSalvar({
        nome: nomeLimpo,
        telefone: telefone.trim(),
        chave_pix: chavePix.trim(),
      });
      setNome('');
      setTelefone('');
      setChavePix('');
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar goleiro.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-fade-in"
    >
      <div className="w-full max-w-md rounded-[4px] border border-borda bg-superficie shadow-carimbo-preto overflow-hidden text-giz">
        {/* Header */}
        <div className="px-4 py-3 bg-superficie-2 border-b border-borda flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base" role="img" aria-label="Luva de goleiro">
              🧤
            </span>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
              Cadastrar Novo Goleiro
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded-[2px] text-giz-fraco hover:text-giz hover:bg-superficie transition min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

          <div>
            <label className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              Nome / Apelido do Goleiro *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Rogério Ceni"
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz placeholder-giz-fraco focus:outline-none focus:border-destaque font-sans min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3 text-destaque" />
                Telefone / WhatsApp (Opcional)
              </span>
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="ex.: (21) 99999-9999"
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz placeholder-giz-fraco focus:outline-none focus:border-destaque font-mono min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
              <span className="inline-flex items-center gap-1">
                <CreditCard className="size-3 text-destaque" />
                Chave PIX (Para pagamento da diária de R$ 30)
              </span>
            </label>
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="ex.: CPF, e-mail, telefone ou chave aleatória"
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz placeholder-giz-fraco focus:outline-none focus:border-destaque font-mono min-h-[44px]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-borda">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-3 py-2 rounded-[3px] border border-borda text-xs font-display font-bold uppercase tracking-wider text-giz-fraco hover:text-giz hover:bg-superficie-2 transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] bg-destaque text-destaque-tinta text-xs font-display font-bold uppercase tracking-wider shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50 min-h-[44px]"
            >
              <UserPlus className="size-3.5" />
              <span>{salvando ? 'Salvando…' : 'Cadastrar e Selecionar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
