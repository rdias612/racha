import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useCache } from '../hooks/useCache';
import { CHAVE_JOGOS, invalidarCachesDependentesDePartida } from '../lib/chavesCache';
import { useSessao } from '../context/SessaoContext';
import { MensagemEstado } from '../components/Estado';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { SkeletonJogos } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { formatarDataLista } from '../lib/formatacao';
import {
  STATUS_LABEL,
  carregarMuralJogos,
  excluirPartida,
  type MuralJogos,
  type PartidaMural,
} from '../lib/partidas';
import { PullToRefresh } from '../components/PullToRefresh';
import { Badge } from '../components/Badge';
import { PainelPlacar } from '../components/PainelPlacar';
import { formatarMensagemErro } from '../lib/erros';

export function Jogos() {
  const isAdmin = useAdmin();
  const { jogador } = useSessao();
  const [idsExcluidos, setIdsExcluidos] = useState<Set<number>>(new Set());
  const [partidaParaExcluir, setPartidaParaExcluir] = useState<PartidaMural | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  // Mural completo (partidas + placares) cacheado: revisitas
  // renderizam na hora e revalidam em background. A query na view
  // `partidas_com_placar` (migration 071) concentra partidas e placares em uma
  // unica consulta (carregarMuralJogos, na lib); a view e pre-requisito deste mural.
  const buscar = useCallback(() => carregarMuralJogos(), []);

  const { dados, carregando, erro, recarregar } = useCache<MuralJogos>(CHAVE_JOGOS, buscar);

  // Exclusões locais sobrepõem o cache até a próxima busca na rede.
  const partidas = (dados?.partidas ?? []).filter((p) => !idsExcluidos.has(p.id));
  const placares = dados?.placares ?? {};

  async function confirmarExclusao() {
    const alvo = partidaParaExcluir;
    if (!alvo || !jogador) return;
    setExcluindo(true);
    try {
      const ok = await excluirPartida(alvo.id, jogador.id);
      if (ok) {
        setIdsExcluidos((anteriores) => new Set(anteriores).add(alvo.id));
        invalidarCachesDependentesDePartida();
        mostrarSnackbar('sucesso', 'Partida excluída da súmula');
      } else {
        mostrarSnackbar('erro', 'Não foi possível excluir a partida.');
      }
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Não foi possível excluir a partida.'));
    } finally {
      setExcluindo(false);
      setPartidaParaExcluir(null);
    }
  }

  if (carregando) return <SkeletonJogos />;
  // Erro apenas na primeira visita (sem cache): com dados em tela, a falha de
  // revalidação em background é tolerada silenciosamente.
  if (erro && !dados)
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;

  return (
    <PullToRefresh onRefresh={recarregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
        {/* Cabeçalho de Súmula */}
        <CabecalhoSumula
          titulo="Mural de Jogos"
          kicker="Temporada Oficial"
          acao={
            isAdmin && (
              <Link
                to="/partida/nova"
                className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase tracking-wider rounded-[3px] border border-destaque bg-destaque text-destaque-tinta px-3 py-1.5 shadow-carimbo hover:brightness-105 transition active:translate-y-px"
              >
                <Plus className="size-3.5" />
                <span>Nova partida</span>
              </Link>
            )
          }
          className="items-center"
        />

        {partidas.length === 0 ? (
          <div className="rounded-[4px] border border-borda bg-superficie p-5 text-center shadow-carimbo">
            <p className="text-sm font-medium text-giz">Ainda não tem jogo na ficha.</p>
            <p className="text-xs text-giz-fraco mt-1 font-mono">
              {isAdmin
                ? 'Cria a primeira partida e convoca a galera para a quinta.'
                : 'A quinta cobra o preço do esquecimento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partidas.map((p) => {
              const pl = placares[p.id];

              return (
                <div
                  key={p.id}
                  className="rounded-[4px] border-2 border-borda bg-superficie shadow-carimbo overflow-hidden transition hover:border-destaque/70"
                >
                  {/* Topo do Card: Data e Status */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-superficie-2 border-b border-borda">
                    <span className="font-mono text-xs font-semibold text-giz">
                      Partida #{p.id} · {formatarDataLista(p.data_jogo)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variante="status" status={p.status}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label="Excluir partida"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPartidaParaExcluir(p);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-[3px] text-giz-fraco hover:text-perigo hover:bg-perigo/10 transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mini-Painel de LED de Placar */}
                  <Link
                    to={p.status === 'live' ? `/partida/${p.id}/ao-vivo` : `/partida/${p.id}`}
                    className="block transition hover:opacity-95"
                  >
                    <PainelPlacar
                      golsTimeA={pl?.gols_time_a ?? null}
                      golsTimeB={pl?.gols_time_b ?? null}
                      status={p.status}
                      variante="compacto"
                    />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {partidaParaExcluir && (
        <ConfirmDialog
          open={partidaParaExcluir != null}
          onClose={() => setPartidaParaExcluir(null)}
          onConfirm={confirmarExclusao}
          titulo="Excluir partida da súmula?"
          mensagem={`A partida de ${formatarDataLista(partidaParaExcluir.data_jogo)} será removida permanentemente, junto com histórico de placar, votos e gols.`}
          textoConfirmar={excluindo ? 'Excluindo…' : 'Excluir'}
          tomConfirmar="perigo"
        />
      )}

      <Snackbar {...snackbarProps} />
    </PullToRefresh>
  );
}
