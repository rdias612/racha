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
import { UserPlus } from 'lucide-react';
import { ListaGoleiros } from '../components/ListaGoleiros';

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

  function pedirAlternanciaStatus(g: JogadorLista) {
    vibrateLight();
    setDialogoConfirmacao({
      goleiro: g,
      novoStatus: !g.is_ativo,
    });
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
        `Goleiro ${goleiro.username} ${novoStatus ? 'ativado' : 'desativado'}.`
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
      ) : (
        <ListaGoleiros
          goleiros={goleirosFiltrados}
          editandoId={editandoId}
          editTelefone={editTelefone}
          editChavePix={editChavePix}
          salvandoEdicao={salvandoEdicao}
          copiadoId={copiadoId}
          aoMudarTelefone={setEditTelefone}
          aoMudarChavePix={setEditChavePix}
          aoIniciarEdicao={iniciarEdicao}
          aoSalvarEdicao={salvarEdicao}
          aoCancelarEdicao={cancelarEdicao}
          aoCopiarPix={copiarPix}
          aoPedirAlternanciaStatus={pedirAlternanciaStatus}
        />
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
            ? `Ativar ${dialogoConfirmacao?.goleiro.username}?`
            : `Desativar ${dialogoConfirmacao?.goleiro.username}?`
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
