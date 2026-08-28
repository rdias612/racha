import { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import {
  listarGoleiros,
  criarGoleiroRapido,
  atualizarDadosPixTelefone,
  alternarStatusAtivoJogador,
  type JogadorLista,
} from '../lib/jogadores';
import { formatarMensagemErro } from '../lib/erros';
import { vibrateLight } from '../lib/haptics';
import { MensagemEstado } from '../components/Estado';
import { ModalNovoGoleiro } from '../components/ModalNovoGoleiro';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CampoBusca } from '../components/CampoBusca';
import {
  UserPlus,
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

export function GestaoGoleiros() {
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();

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

  const timerCopiadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerCopiadoRef.current) {
        clearTimeout(timerCopiadoRef.current);
      }
    };
  }, []);

  // Estado para ConfirmDialog de alternância de status ativo/inativo
  const [dialogoConfirmacao, setDialogoConfirmacao] = useState<{
    goleiro: JogadorLista;
    novoStatus: boolean;
  } | null>(null);

  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await listarGoleiros();
        if (ativo) setGoleiros(dados);
      } catch (err) {
        if (ativo) setErro(formatarMensagemErro(err, 'Erro ao carregar goleiros.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const goleirosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return goleiros;
    return goleiros.filter(
      (g) =>
        g.username.toLowerCase().includes(termo) ||
        (g.telefone && g.telefone.includes(termo)) ||
        (g.chave_pix && g.chave_pix.toLowerCase().includes(termo))
    );
  }, [goleiros, busca]);

  async function handleSalvarNovo(dados: { nome: string; telefone: string; chave_pix: string }) {
    if (!jogadorLogado?.id) return;
    await criarGoleiroRapido(dados, jogadorLogado.id);
    const lista = await listarGoleiros();
    setGoleiros(lista);
    mostrarSnackbar('sucesso', 'Goleiro cadastrado com sucesso!');
  }

  function iniciarEdicao(g: JogadorLista) {
    vibrateLight();
    setEditandoId(g.id);
    setEditTelefone(g.telefone ?? '');
    setEditChavePix(g.chave_pix ?? '');
  }

  function cancelarEdicao() {
    vibrateLight();
    setEditandoId(null);
    setEditTelefone('');
    setEditChavePix('');
  }

  async function salvarEdicao(id: number) {
    if (!jogadorLogado?.id) return;
    setSalvandoEdicao(true);
    try {
      await atualizarDadosPixTelefone(
        id,
        {
          telefone: editTelefone,
          chave_pix: editChavePix,
        },
        jogadorLogado.id
      );
      const lista = await listarGoleiros();
      setGoleiros(lista);
      setEditandoId(null);
      mostrarSnackbar('sucesso', 'Dados atualizados com sucesso!');
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Erro ao atualizar goleiro.'));
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function confirmarAlternanciaStatus() {
    if (!dialogoConfirmacao || !jogadorLogado?.id) return;
    const { goleiro, novoStatus } = dialogoConfirmacao;
    setDialogoConfirmacao(null);

    try {
      await alternarStatusAtivoJogador(goleiro.id, novoStatus, jogadorLogado.id);
      const lista = await listarGoleiros();
      setGoleiros(lista);
      mostrarSnackbar(
        'sucesso',
        `Goleiro @${goleiro.username} ${novoStatus ? 'ativado' : 'desativado'}.`
      );
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Erro ao alterar status do atleta.'));
    }
  }

  async function copiarPix(id: number, pix: string) {
    try {
      await navigator.clipboard.writeText(pix);
      setCopiadoId(id);
      if (timerCopiadoRef.current) {
        clearTimeout(timerCopiadoRef.current);
      }
      timerCopiadoRef.current = setTimeout(() => setCopiadoId(null), 2500);
      vibrateLight();
      mostrarSnackbar('sucesso', 'Chave PIX copiada!');
    } catch {
      mostrarSnackbar('erro', 'Não foi possível copiar a chave PIX.');
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const totalAtivos = goleiros.filter((g) => g.is_ativo).length;

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      {/* Botão Voltar */}
      <BotaoVoltar fallback="/" label="início" />

      {/* Header Editorial */}
      <div className="sumula-header flex items-center justify-between gap-3 pb-3 border-b border-borda">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label="Luva">
              🧤
            </span>
            <h2 className="font-display font-black text-xl uppercase tracking-wider text-giz">
              Gestão de Goleiros
            </h2>
          </div>
          <p className="text-xs font-mono text-giz-fraco mt-0.5">
            Cadastro, contato e chave PIX para diárias de R$ 30,00 ({totalAtivos} ativos)
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            vibrateLight();
            setModalNovoAberto(true);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[4px] bg-destaque text-destaque-tinta font-display font-bold text-xs uppercase tracking-wider shadow-carimbo hover:brightness-105 active:translate-y-px transition min-h-[44px]"
        >
          <UserPlus className="size-4" />
          <span>+ Novo Goleiro</span>
        </button>
      </div>

      {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

      {/* Busca */}
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar por nome, telefone ou chave PIX…"
      />

      {/* Listagem Contínua Canônica */}
      {carregando ? (
        <div className="p-8 text-center text-xs font-mono text-giz-fraco">Carregando goleiros…</div>
      ) : goleirosFiltrados.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-borda rounded-[4px] bg-superficie">
          <p className="text-xs font-mono text-giz-fraco">Nenhum goleiro encontrado.</p>
        </div>
      ) : (
        <div className="border-y border-borda divide-y divide-borda/40 bg-superficie">
          {goleirosFiltrados.map((g) => {
            const estaEditando = editandoId === g.id;
            const foiCopiado = copiadoId === g.id;
            const temTel = Boolean(g.telefone?.trim());
            const temPix = Boolean(g.chave_pix?.trim());
            const zapLink = temTel ? `https://wa.me/55${g.telefone?.replace(/\D/g, '')}` : null;

            return (
              <div
                key={g.id}
                className={`p-3.5 transition ${
                  g.is_ativo
                    ? 'bg-superficie hover:bg-superficie-2/50'
                    : 'bg-superficie/40 opacity-70'
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
                          @{g.username}
                        </h3>
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-[2px] border ${
                            g.is_ativo
                              ? 'bg-ok/15 text-ok border-ok/40'
                              : 'bg-perigo/15 text-perigo border-perigo/40'
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
                          onClick={() => iniciarEdicao(g)}
                          title="Editar dados"
                          aria-label={`Editar dados de @${g.username}`}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque active:translate-y-px transition flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque-texto"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            vibrateLight();
                            setDialogoConfirmacao({
                              goleiro: g,
                              novoStatus: !g.is_ativo,
                            });
                          }}
                          title={g.is_ativo ? 'Desativar goleiro' : 'Ativar goleiro'}
                          aria-label={`${g.is_ativo ? 'Desativar' : 'Ativar'} @${g.username}`}
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
                          onClick={() => salvarEdicao(g.id)}
                          disabled={salvandoEdicao}
                          title="Salvar alterações"
                          aria-label="Salvar alterações"
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-[4px] bg-destaque text-destaque-tinta font-bold shadow-carimbo hover:brightness-105 active:translate-y-px transition flex items-center justify-center disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-destaque-texto"
                        >
                          <Save className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          disabled={salvandoEdicao}
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
                        onChange={(e) => setEditTelefone(e.target.value)}
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
                        onChange={(e) => setEditChavePix(e.target.value)}
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
                          onClick={() => copiarPix(g.id, g.chave_pix!)}
                          title="Copiar Chave PIX"
                          aria-label={`Copiar Chave PIX de @${g.username}`}
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
          })}
        </div>
      )}

      {/* Modal de Criação Rápida */}
      <ModalNovoGoleiro
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        onSalvar={handleSalvarNovo}
      />

      {/* Diálogo de Confirmação Acessível */}
      <ConfirmDialog
        open={Boolean(dialogoConfirmacao)}
        titulo={
          dialogoConfirmacao?.novoStatus
            ? `Ativar @${dialogoConfirmacao?.goleiro.username}?`
            : `Desativar @${dialogoConfirmacao?.goleiro.username}?`
        }
        mensagem={
          dialogoConfirmacao?.novoStatus
            ? 'O goleiro voltará a aparecer como disponível para seleção nas escalações de partidas.'
            : 'O goleiro não aparecerá mais nos seletores de times enquanto estiver inativo.'
        }
        textoConfirmar={dialogoConfirmacao?.novoStatus ? 'Ativar Goleiro' : 'Desativar Goleiro'}
        textoCancelar="Voltar"
        tomConfirmar={dialogoConfirmacao?.novoStatus ? 'destaque' : 'perigo'}
        onConfirm={confirmarAlternanciaStatus}
        onClose={() => setDialogoConfirmacao(null)}
      />

      {/* Toast Feedback */}
      <Snackbar {...snackbarProps} />
    </div>
  );
}
