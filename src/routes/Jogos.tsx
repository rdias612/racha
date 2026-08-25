import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import { useCache, invalidarCache } from '../hooks/useCache';
import { useSessao } from '../context/SessaoContext';
import { MensagemEstado } from '../components/Estado';
import { SkeletonJogos } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { formatarDataLista } from '../lib/formatacao';
import { STATUS_LABEL, excluirPartida, type StatusPartida } from '../lib/partidas';
import { PullToRefresh } from '../components/PullToRefresh';
import { Badge } from '../components/Badge';

interface Partida {
  id: number;
  data_jogo: string;
  status: StatusPartida;
}

interface Placar {
  partida_id: number;
  gols_time_a: number;
  gols_time_b: number;
}

interface DadosJogos {
  partidas: Partida[];
  placares: Record<number, Placar>;
}

// Caminho legado (fallback para bancos sem a view da migration 071): busca
// `partidas` e, em seguida, `partida_placar.in(ids)` — o waterfall original.
async function buscarJogosDuasQueries(): Promise<DadosJogos> {
  const { data: ps, error } = await supabase
    .from('partidas')
    .select('id, data_jogo, status')
    .order('data_jogo', { ascending: false });
  if (error) throw error;

  const partidas: Partida[] = (ps ?? []).map((p) => ({
    id: p.id,
    data_jogo: p.data_jogo,
    status: p.status as StatusPartida,
  }));
  const placares: Record<number, Placar> = {};
  if (partidas.length > 0) {
    const ids = partidas.map((p) => p.id);
    const { data: pls } = await supabase
      .from('partida_placar')
      .select('partida_id, gols_time_a, gols_time_b')
      .in('partida_id', ids);
    for (const pl of pls ?? []) {
      if (pl.partida_id != null) {
        placares[pl.partida_id] = {
          partida_id: pl.partida_id,
          gols_time_a: pl.gols_time_a ?? 0,
          gols_time_b: pl.gols_time_b ?? 0,
        };
      }
    }
  }
  return { partidas, placares };
}

export function Jogos() {
  const isAdmin = useAdmin();
  const { jogador } = useSessao();
  const [idsExcluidos, setIdsExcluidos] = useState<Set<number>>(new Set());
  const [partidaParaExcluir, setPartidaParaExcluir] = useState<Partida | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  // Mural completo (partidas + placares) cacheado em 'jogos': revisitas
  // renderizam na hora e revalidam em background. Uma unica query na view
  // `partidas_com_placar` (migration 071) elimina o waterfall de duas idas ao
  // banco; se a view ainda nao existir no banco, cai para o caminho antigo.
  const buscar = useCallback(async (): Promise<DadosJogos> => {
    const { data, error } = await supabase
      .from('partidas_com_placar')
      .select('id, data_jogo, status, gols_time_a, gols_time_b')
      .order('data_jogo', { ascending: false });

    if (!error && data) {
      const partidas: Partida[] = [];
      const placares: Record<number, Placar> = {};
      for (const { id, data_jogo, status, gols_time_a, gols_time_b } of data) {
        if (id != null && data_jogo != null && status != null) {
          partidas.push({ id, data_jogo, status: status as StatusPartida });
          placares[id] = {
            partida_id: id,
            gols_time_a: gols_time_a ?? 0,
            gols_time_b: gols_time_b ?? 0,
          };
        }
      }
      return { partidas, placares };
    }

    // View ausente no banco (migration 071 ainda nao aplicada): o PostgREST
    // devolve PGRST205 (relation fora do schema cache) ou o Postgres 42P01
    // (undefined_table). Volta as duas queries originais; qualquer outro erro
    // propaga normalmente.
    const viewAusente =
      error != null &&
      (error.code === 'PGRST205' ||
        error.code === '42P01' ||
        /does not exist|schema cache/i.test(error.message));
    if (!viewAusente) throw error;

    return buscarJogosDuasQueries();
  }, []);

  const { dados, carregando, erro, recarregar } = useCache<DadosJogos>('jogos', buscar);

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
        invalidarCache('jogos');
        invalidarCache('resumo');
        mostrarSnackbar('sucesso', 'Partida excluída da súmula');
      } else {
        mostrarSnackbar('erro', 'Não foi possível excluir a partida');
      }
    } catch {
      mostrarSnackbar('erro', 'Não foi possível excluir a partida');
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
        <div className="flex items-center justify-between sumula-header pb-2">
          <div>
            <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
              Mural de Jogos
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
              Temporada Oficial
            </p>
          </div>
          {isAdmin && (
            <Link
              to="/partida/nova"
              className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase tracking-wider rounded-[3px] border border-destaque bg-destaque text-destaque-tinta px-3 py-1.5 shadow-carimbo hover:brightness-105 transition active:translate-y-px"
            >
              <Plus className="size-3.5" />
              <span>Nova partida</span>
            </Link>
          )}
        </div>

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
                    className="block bg-[#000000] p-3 text-center transition hover:bg-[#080808]"
                  >
                    <div className="flex items-center justify-between gap-2 max-w-sm mx-auto">
                      {/* Time Preto */}
                      <div className="flex-1 flex items-center justify-end gap-2 text-right">
                        <span className="font-display font-black text-sm uppercase tracking-wider text-[#f4f1e8]">
                          PRETO
                        </span>
                        <span className="size-2 rounded-full bg-[#0d0d0e] border border-[#35302a]" />
                      </div>

                      {/* Dígitos de LED */}
                      <div className="px-3 py-1 min-w-[90px]">
                        <span
                          className={`font-display font-black text-3xl tabular-nums tracking-tight ${
                            p.status === 'live'
                              ? 'text-destaque [text-shadow:0_0_10px_rgba(255,179,0,0.5)]'
                              : p.status === 'closed'
                                ? 'text-branco-time'
                                : 'text-destaque'
                          }`}
                        >
                          {p.status === 'draft' || !pl
                            ? '— × —'
                            : `${pl.gols_time_a} × ${pl.gols_time_b}`}
                        </span>
                      </div>

                      {/* Time Branco */}
                      <div className="flex-1 flex items-center justify-start gap-2 text-left">
                        <span className="size-2 rounded-full bg-[#f4f1e8] border border-[#35302a]" />
                        <span className="font-display font-black text-sm uppercase tracking-wider text-[#f4f1e8]">
                          BRANCO
                        </span>
                      </div>
                    </div>
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
