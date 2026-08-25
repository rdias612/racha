import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { supabase } from '../lib/supabase';
import {
  listarGoleiros,
  criarGoleiroRapido,
  atualizarDadosPixTelefone,
  type JogadorLista,
} from '../lib/jogadores';
import { voltar } from '../lib/navegacao';
import { MensagemEstado } from '../components/Estado';
import { ModalNovoGoleiro } from '../components/ModalNovoGoleiro';
import { Snackbar, type TipoSnackbar } from '../components/Snackbar';
import {
  ArrowLeft,
  UserPlus,
  Phone,
  CreditCard,
  Copy,
  Check,
  Edit2,
  Save,
  X,
  Power,
  Search,
} from 'lucide-react';

export function GestaoGoleiros() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [goleiros, setGoleiros] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editTelefone, setEditTelefone] = useState('');
  const [editChavePix, setEditChavePix] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  const [snackbar, setSnackbar] = useState<{
    mensagem: string;
    tipo?: TipoSnackbar;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await listarGoleiros();
        if (ativo) setGoleiros(dados);
      } catch (err) {
        if (ativo) setErro(err instanceof Error ? err.message : 'Erro ao carregar goleiros.');
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleSalvarNovo(dados: { nome: string; telefone: string; chave_pix: string }) {
    await criarGoleiroRapido(dados);
    const lista = await listarGoleiros();
    setGoleiros(lista);
    setSnackbar({ mensagem: 'Goleiro cadastrado com sucesso!', tipo: 'sucesso' });
  }

  function iniciarEdicao(g: JogadorLista) {
    setEditandoId(g.id);
    setEditTelefone(g.telefone ?? '');
    setEditChavePix(g.chave_pix ?? '');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditTelefone('');
    setEditChavePix('');
  }

  async function salvarEdicao(id: number) {
    setSalvandoEdicao(true);
    try {
      await atualizarDadosPixTelefone(id, {
        telefone: editTelefone,
        chave_pix: editChavePix,
      });
      const lista = await listarGoleiros();
      setGoleiros(lista);
      setEditandoId(null);
      setSnackbar({ mensagem: 'Dados atualizados com sucesso!', tipo: 'sucesso' });
    } catch (err) {
      setSnackbar({
        mensagem: err instanceof Error ? err.message : 'Erro ao atualizar goleiro.',
        tipo: 'erro',
      });
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function toggleAtivo(g: JogadorLista) {
    const novoStatus = !g.is_ativo;
    try {
      const { error: err } = await supabase
        .from('jogadores')
        .update({ is_ativo: novoStatus })
        .eq('id', g.id);

      if (err) throw err;
      const lista = await listarGoleiros();
      setGoleiros(lista);
      setSnackbar({
        mensagem: `Goleiro @${g.username} ${novoStatus ? 'ativado' : 'desativado'}.`,
        tipo: 'sucesso',
      });
    } catch (err) {
      setSnackbar({
        mensagem: err instanceof Error ? err.message : 'Erro ao alterar status.',
        tipo: 'erro',
      });
    }
  }

  async function copiarPix(id: number, pix: string) {
    try {
      await navigator.clipboard.writeText(pix);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2500);
      setSnackbar({ mensagem: 'Chave PIX copiada!', tipo: 'sucesso' });
    } catch {
      setSnackbar({ mensagem: 'Não foi possível copiar a chave PIX.', tipo: 'erro' });
    }
  }

  const goleirosFiltrados = goleiros.filter(
    (g) =>
      g.username.toLowerCase().includes(busca.toLowerCase()) ||
      (g.telefone && g.telefone.includes(busca)) ||
      (g.chave_pix && g.chave_pix.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      {/* Botão Voltar */}
      <button
        type="button"
        onClick={() => voltar(navigate, '/administrador')}
        className="inline-flex items-center gap-1.5 text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        <ArrowLeft className="size-3.5" />
        <span>painel financeiro</span>
      </button>

      {/* Header */}
      <div className="sumula-header flex items-center justify-between gap-3 pb-2 border-b border-borda">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧤</span>
            <h2 className="font-display font-black text-xl uppercase tracking-wider text-giz">
              Gestão de Goleiros
            </h2>
          </div>
          <p className="text-xs font-mono text-giz-fraco mt-0.5">
            Cadastro, contato e chave PIX para diárias de R$ 30,00
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNovoAberto(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-[3px] bg-destaque text-destaque-tinta font-display font-bold text-xs uppercase tracking-wider shadow-carimbo hover:brightness-105 active:translate-y-px transition min-h-[44px]"
        >
          <UserPlus className="size-3.5" />
          <span>+ Novo Goleiro</span>
        </button>
      </div>

      {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-giz-fraco" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou chave PIX…"
          className="w-full pl-9 pr-3 py-2 rounded-[4px] border border-borda bg-superficie-2 text-xs font-sans text-giz placeholder-giz-fraco focus:outline-none focus:border-destaque min-h-[44px]"
        />
      </div>

      {/* Listagem */}
      {carregando ? (
        <div className="p-8 text-center text-xs font-mono text-giz-fraco">Carregando goleiros…</div>
      ) : goleirosFiltrados.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-borda rounded-[4px] bg-superficie">
          <p className="text-xs font-mono text-giz-fraco">Nenhum goleiro encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goleirosFiltrados.map((g) => {
            const estaEditando = editandoId === g.id;
            const foiCopiado = copiadoId === g.id;
            const temTel = Boolean(g.telefone?.trim());
            const temPix = Boolean(g.chave_pix?.trim());
            const zapLink = temTel ? `https://wa.me/55${g.telefone?.replace(/\D/g, '')}` : null;

            return (
              <div
                key={g.id}
                className={`rounded-[4px] border bg-superficie p-3.5 shadow-carimbo transition ${
                  g.is_ativo ? 'border-borda' : 'border-perigo/40 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧤</span>
                    <div>
                      <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
                        @{g.username}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-block px-1.5 py-0.2 text-[10px] font-mono uppercase tracking-wider rounded-[2px] border ${
                            g.is_ativo
                              ? 'bg-ok/15 text-ok border-ok/40'
                              : 'bg-perigo/15 text-perigo border-perigo/40'
                          }`}
                        >
                          {g.is_ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        {g.posicao_b && (
                          <span className="text-[10px] font-mono text-giz-fraco">
                            (Linha: {g.posicao_b})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações de Topo */}
                  <div className="flex items-center gap-1">
                    {!estaEditando ? (
                      <>
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(g)}
                          title="Editar dados"
                          className="p-1.5 rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAtivo(g)}
                          title={g.is_ativo ? 'Desativar goleiro' : 'Ativar goleiro'}
                          className={`p-1.5 rounded-[3px] border transition min-h-[36px] min-w-[36px] flex items-center justify-center ${
                            g.is_ativo
                              ? 'border-borda bg-superficie-2 text-giz-fraco hover:text-perigo hover:border-perigo'
                              : 'border-ok/40 bg-ok/10 text-ok hover:bg-ok/20'
                          }`}
                        >
                          <Power className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => salvarEdicao(g.id)}
                          disabled={salvandoEdicao}
                          title="Salvar alterações"
                          className="p-1.5 rounded-[3px] bg-destaque text-destaque-tinta font-bold transition min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-50"
                        >
                          <Save className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          disabled={salvandoEdicao}
                          title="Cancelar edição"
                          className="p-1.5 rounded-[3px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Corpo do Card: Visualização ou Edição */}
                {estaEditando ? (
                  <div className="mt-3 pt-3 border-t border-borda space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-0.5">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={editTelefone}
                        onChange={(e) => setEditTelefone(e.target.value)}
                        placeholder="ex.: (21) 99999-9999"
                        className="w-full px-2.5 py-1.5 rounded-[3px] border border-borda bg-superficie-2 text-xs font-mono text-giz focus:outline-none focus:border-destaque min-h-[38px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-0.5">
                        Chave PIX
                      </label>
                      <input
                        type="text"
                        value={editChavePix}
                        onChange={(e) => setEditChavePix(e.target.value)}
                        placeholder="ex.: CPF, e-mail, telefone ou chave aleatória"
                        className="w-full px-2.5 py-1.5 rounded-[3px] border border-borda bg-superficie-2 text-xs font-mono text-giz focus:outline-none focus:border-destaque min-h-[38px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2.5 border-t border-borda grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {/* Telefone */}
                    <div className="flex items-center gap-1.5 text-giz-fraco">
                      <Phone className="size-3.5 shrink-0 text-destaque" />
                      {temTel ? (
                        zapLink ? (
                          <a
                            href={zapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-destaque hover:underline"
                          >
                            {g.telefone} ↗
                          </a>
                        ) : (
                          <span className="text-giz">{g.telefone}</span>
                        )
                      ) : (
                        <span className="italic text-[11px]">Sem telefone</span>
                      )}
                    </div>

                    {/* Chave PIX */}
                    <div className="flex items-center justify-between gap-1 text-giz-fraco">
                      <div className="flex items-center gap-1.5 truncate">
                        <CreditCard className="size-3.5 shrink-0 text-destaque" />
                        {temPix ? (
                          <span className="truncate text-giz" title={g.chave_pix ?? ''}>
                            {g.chave_pix}
                          </span>
                        ) : (
                          <span className="italic text-[11px]">Sem chave PIX</span>
                        )}
                      </div>

                      {temPix && (
                        <button
                          type="button"
                          onClick={() => copiarPix(g.id, g.chave_pix!)}
                          title="Copiar Chave PIX"
                          className="shrink-0 p-1 rounded-[2px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque transition flex items-center gap-1 text-[10px]"
                        >
                          {foiCopiado ? (
                            <>
                              <Check className="size-3 text-ok" />
                              <span className="text-ok">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
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
          })}
        </div>
      )}

      {/* Modal de Criação Rápida */}
      <ModalNovoGoleiro
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        onSalvar={handleSalvarNovo}
      />

      {/* Toast Feedback */}
      <Snackbar
        mensagem={snackbar?.mensagem ?? ''}
        tipo={snackbar?.tipo}
        visivel={Boolean(snackbar)}
        onFechar={() => setSnackbar(null)}
      />
    </div>
  );
}
