import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSnackbar } from '../hooks/useSnackbar';
import { AbasClipesAdmin } from '../components/AbasClipesAdmin';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { SecaoDisparoClipes } from '../components/SecaoDisparoClipes';
import { SecaoFalhasRecentesClipes } from '../components/SecaoFalhasRecentesClipes';
import { SecaoHistoricoImportacoes } from '../components/SecaoHistoricoImportacoes';
import {
  dispararImportacaoClipes,
  obterImportacoesClipes,
  obterFalhasRecentesClipes,
  type ImportacaoClipes,
} from '../lib/clipes';
import { formatarMensagemErro } from '../lib/erros';

export function ClipesAdmin() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  const [importacoes, setImportacoes] = useState<ImportacaoClipes[]>([]);
  const [falhas, setFalhas] = useState<ImportacaoClipes[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [dataConfirmacao, setDataConfirmacao] = useState<string | null>(null);
  const [disparando, setDisparando] = useState(false);

  // Duas listagens independentes com erro isolado por fonte — padrão
  // Promise.allSettled de Administrador.tsx:62-80.
  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      const [rHist, rFalhas] = await Promise.allSettled([
        obterImportacoesClipes(jogador.id),
        obterFalhasRecentesClipes(jogador.id),
      ]);
      if (isAtivo && !isAtivo()) return;
      if (rHist.status === 'fulfilled') {
        setImportacoes(rHist.value);
        setErroHistorico(null);
      } else {
        setErroHistorico(formatarMensagemErro(rHist.reason, 'Erro ao carregar o histórico.'));
      }
      if (rFalhas.status === 'fulfilled') setFalhas(rFalhas.value);
      setCarregando(false);
    },
    [jogador, isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleConfirmarDisparo() {
    if (!jogador || !dataConfirmacao) return;
    const data = dataConfirmacao;
    setDataConfirmacao(null);
    setDisparando(true);
    try {
      await dispararImportacaoClipes(jogador.id, data);
      mostrarSnackbar('sucesso', `Importação de ${data} disparada. Acompanhe no histórico abaixo.`);
      await carregar();
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Falha ao disparar a importação.'));
    } finally {
      setDisparando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/" />

      <CabecalhoSumula
        titulo="Gestão de Clipes"
        icone={<Film className="size-5 text-destaque-texto" />}
        acao="Filma Eu"
        className="items-center"
      />

      <AbasClipesAdmin />

      <SecaoFalhasRecentesClipes falhas={falhas} carregando={carregando} erro={null} />

      <SecaoDisparoClipes disparando={disparando} onSolicitarDisparo={setDataConfirmacao} />

      <SecaoHistoricoImportacoes
        importacoes={importacoes}
        carregando={carregando}
        erro={erroHistorico}
        onAtualizar={() => carregar()}
      />

      {dataConfirmacao && (
        <ConfirmDialog
          open
          titulo="Disparar importação?"
          mensagem={`Disparar a importação dos clipes do dia ${dataConfirmacao} (slot 19h) no GitHub Actions?`}
          onConfirm={handleConfirmarDisparo}
          onClose={() => setDataConfirmacao(null)}
        />
      )}

      <Snackbar {...snackbarProps} />
    </div>
  );
}
