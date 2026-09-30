import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { MensagemEstado } from '../components/Estado';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventosAutomaticosFinanceiro } from '../components/EventosAutomaticosFinanceiro';
import { FormLancamentoFinanceiro } from '../components/FormLancamentoFinanceiro';
import { ListaDespesasAbertas } from '../components/ListaDespesasAbertas';
import { ListaReceitasAbertas } from '../components/ListaReceitasAbertas';
import { PullToRefresh } from '../components/PullToRefresh';
import { SecaoExportacaoFinanceira } from '../components/SecaoExportacaoFinanceira';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { isRandomUsername, listarJogadoresAtivos } from '../lib/jogadores';
import { useCache } from '../hooks/useCache';
import { CHAVE_ELENCO_ATIVO } from '../lib/chavesCache';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { formatarMensagemErro } from '../lib/erros';
import {
  isMigrationAusenteNatureza,
  listarDividasEmAberto,
  listarResumoDevedores,
  quitarDivida,
  quitarDividasJogador,
  type Divida,
  type DividaPorJogador,
} from '../lib/dividas';

export function Administrador() {
  const isAdmin = useAdmin();

  const [grupos, setGrupos] = useState<DividaPorJogador[]>([]);
  const [despesas, setDespesas] = useState<Divida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();
  const [confirmacao, setConfirmacao] = useState<{
    open: boolean;
    titulo: string;
    mensagem: string;
    onConfirm: () => void;
  } | null>(null);

  // Elenco carrega à parte do financeiro: falha na coluna `natureza` (migração
  // 078) não pode esvaziar o dropdown do formulário — e falha do próprio
  // elenco deixa o dropdown vazio sem derrubar o resto da tela.
  const { dados: elenco, carregando: carregandoElenco, erro: erroElenco } = useCache(
    CHAVE_ELENCO_ATIVO,
    listarJogadoresAtivos
  );
  const jogadores = elenco?.filter((j) => !isRandomUsername(j.username)) ?? [];
  const erroTela = [erroElenco, erro].filter(Boolean).join(' ');

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!isAdmin) return;
      setCarregando(true);
      setErro(null);
      try {
        const [rResumo, rLancamentos] = await Promise.allSettled([
          listarResumoDevedores(),
          listarDividasEmAberto(),
        ]);
        if (isAtivo && !isAtivo()) return;

        if (rResumo.status === 'rejected' || rLancamentos.status === 'rejected') {
          const motivo =
            rLancamentos.status === 'rejected'
              ? rLancamentos.reason
              : rResumo.status === 'rejected'
                ? rResumo.reason
                : null;
          const msg = formatarMensagemErro(motivo, 'Erro ao carregar lançamentos.');
          setErro(
            isMigrationAusenteNatureza(msg)
              ? 'Aplique a migration 078_dividas_natureza_despesa.sql no Supabase para receitas/despesas.'
              : msg
          );
          setGrupos([]);
          setDespesas([]);
        } else {
          const resumo = rResumo.value;
          const lancamentos = rLancamentos.value;
          const receitas = lancamentos.filter((d) => d.natureza !== 'despesa');
          const despesasAbertas = lancamentos.filter((d) => d.natureza === 'despesa');
          setDespesas(despesasAbertas);

          const itensPorJogador = new Map<number, Divida[]>();
          for (const d of receitas) {
            if (d.jogador_id == null) continue;
            const arr = itensPorJogador.get(d.jogador_id) ?? [];
            arr.push(d);
            itensPorJogador.set(d.jogador_id, arr);
          }
          setGrupos(
            resumo.map((r) => ({
              jogador_id: r.jogador_id,
              username: r.username,
              is_mensalista: r.is_mensalista,
              total_devido: Number(r.total_devido),
              dividas: itensPorJogador.get(r.jogador_id) ?? [],
            }))
          );
        }
      } catch (e) {        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(e, 'Erro ao carregar lançamentos.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

  function handleQuitar(dividaId: number, username: string) {
    setConfirmacao({
      open: true,
      titulo: 'Quitar lançamento?',
      mensagem: `Marcar o lançamento de ${username} como quitado na súmula financeira?`,
      onConfirm: async () => {
        setConfirmacao(null);
        const gruposAnteriores = grupos;
        const despesasAnteriores = despesas;

        setGrupos((prev) =>
          prev
            .map((g) => {
              const dividaAlvo = g.dividas.find((d) => d.id === dividaId);
              if (!dividaAlvo) return g;
              const novasDividas = g.dividas.filter((d) => d.id !== dividaId);
              const novoTotal = Math.max(0, g.total_devido - Number(dividaAlvo.valor));
              return {
                ...g,
                total_devido: novoTotal,
                dividas: novasDividas,
              };
            })
            .filter((g) => g.dividas.length > 0 && g.total_devido > 0)
        );
        setDespesas((prev) => prev.filter((d) => d.id !== dividaId));

        try {
          await quitarDivida(dividaId);
          mostrarSnackbar('sucesso', 'Lançamento marcado como quitado.');
          await carregar();
        } catch (err) {
          setGrupos(gruposAnteriores);
          setDespesas(despesasAnteriores);
          mostrarSnackbar('erro', formatarMensagemErro(err, 'Erro ao quitar lançamento.'));
        }
      },
    });
  }

  function handleQuitarTodas(jogadorId: number, username: string) {
    setConfirmacao({
      open: true,
      titulo: 'Quitar todas as receitas?',
      mensagem: `Quitar TODAS as pendências em aberto de ${username}?`,
      onConfirm: async () => {
        setConfirmacao(null);
        const gruposAnteriores = grupos;

        setGrupos((prev) => prev.filter((g) => g.jogador_id !== jogadorId));

        try {
          await quitarDividasJogador(jogadorId);
          mostrarSnackbar('sucesso', `Receitas de ${username} quitadas.`);
          await carregar();
        } catch (err) {
          setGrupos(gruposAnteriores);
          mostrarSnackbar('erro', formatarMensagemErro(err, 'Erro ao quitar receitas.'));
        }
      },
    });
  }

  return (
    <PullToRefresh onRefresh={() => carregar()}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
        <BotaoVoltar fallback="/" />

        <CabecalhoSumula
          titulo="Controle Financeiro"
          icone={<Wallet className="size-5 text-destaque-texto" />}
          acao="Súmula CBO"
          className="items-center"
        />

        {erroTela && <MensagemEstado>{erroTela}</MensagemEstado>}

        <FormLancamentoFinanceiro
          jogadores={jogadores}
          onSucesso={(mensagem) => mostrarSnackbar('sucesso', mensagem)}
          onErro={setErro}
          onRecarregar={carregar}
        />

        <SecaoExportacaoFinanceira onNotificar={mostrarSnackbar} />

        <EventosAutomaticosFinanceiro
          jogadores={jogadores}
          onMensagem={(tipo, mensagem) => mostrarSnackbar(tipo, mensagem)}
        />

        <ListaReceitasAbertas
          grupos={grupos}
          carregando={carregando || carregandoElenco}
          onNotificar={mostrarSnackbar}
          onSolicitarQuitar={handleQuitar}
          onSolicitarQuitarTodas={handleQuitarTodas}
        />

        <ListaDespesasAbertas
          despesas={despesas}
          carregando={carregando || carregandoElenco}
          onNotificar={mostrarSnackbar}
          onSolicitarQuitar={handleQuitar}
        />

        {confirmacao && (
          <ConfirmDialog
            open={confirmacao.open}
            onClose={() => setConfirmacao(null)}
            onConfirm={confirmacao.onConfirm}
            titulo={confirmacao.titulo}
            mensagem={confirmacao.mensagem}
          />
        )}

        <Snackbar {...snackbarProps} />
      </div>
    </PullToRefresh>
  );
}
