import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { AbasNotificacoes } from '../components/AbasNotificacoes';
import { SecaoNotificacaoSaude } from '../components/SecaoNotificacaoSaude';
import { obterPainelEntregasPush, type PainelEntregaJogador } from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';

const TABS_NOTIFICACOES = [
  '/notificacoes/confirmacao',
  '/notificacoes/votacao',
  '/notificacoes/testes',
  '/notificacoes/saude',
];

export function NotificacoesSaude() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();

  const [painel, setPainel] = useState<PainelEntregaJogador[]>([]);
  const [carregandoPainel, setCarregandoPainel] = useState(true);
  const [erroPainel, setErroPainel] = useState<string | null>(null);

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: TABS_NOTIFICACOES,
    activeTab: '/notificacoes/saude',
  });

  const carregarPainel = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregandoPainel(true);
      setErroPainel(null);

      try {
        const dados = await obterPainelEntregasPush(jogador.id);
        if (isAtivo && !isAtivo()) return;
        setPainel(dados);
      } catch (err) {
        if (isAtivo && !isAtivo()) return;
        setErroPainel(formatarMensagemErro(err, 'Erro ao carregar o quadro de entregas.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregandoPainel(false);
      }
    },
    [jogador, isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregarPainel(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregarPainel]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz touch-pan-y"
      {...swipeHandlers}
    >
      <BotaoVoltar fallback="/" />

      <CabecalhoSumula
        titulo="Gestão de Notificações"
        icone={<Bell className="size-5 text-destaque-texto" />}
        acao="Painel Push"
        className="items-center"
      />

      <AbasNotificacoes />

      <SecaoNotificacaoSaude
        dados={painel}
        carregando={carregandoPainel}
        erro={erroPainel}
        onAtualizar={() => carregarPainel()}
      />
    </div>
  );
}
