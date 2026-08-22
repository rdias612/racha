import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import { useSessao } from '../context/SessaoContext';
import { MensagemEstado } from '../components/Estado';
import { SkeletonJogos } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar, type TipoSnackbar } from '../components/Snackbar';
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

export function Jogos() {
  const isAdmin = useAdmin();
  const { jogador } = useSessao();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [placares, setPlacares] = useState<Record<number, Placar>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [partidaParaExcluir, setPartidaParaExcluir] = useState<Partida | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    visivel: boolean;
    tipo: TipoSnackbar;
    mensagem: string;
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' });

  function mostrarSnackbar(tipo: TipoSnackbar, mensagem: string) {
    setSnackbar({ visivel: true, tipo, mensagem });
  }

  const carregar = useCallback(async (isAtivo?: () => boolean) => {
    setCarregando(true);
    setErro(null);
    const { data: ps, error } = await supabase
      .from('partidas')
      .select('id, data_jogo, status')
      .order('data_jogo', { ascending: false });

    if (isAtivo && !isAtivo()) return;
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    setPartidas(ps ?? []);

    if (ps && ps.length > 0) {
      const ids = ps.map((p) => p.id);
      const { data: pls } = await supabase
        .from('partida_placar')
        .select('partida_id, gols_time_a, gols_time_b')
        .in('partida_id', ids);
      if (isAtivo && !isAtivo()) return;
      const mapa: Record<number, Placar> = {};
      for (const pl of pls ?? []) mapa[pl.partida_id] = pl;
      setPlacares(mapa);
    }
    if (!isAtivo || isAtivo()) setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  async function confirmarExclusao() {
    const alvo = partidaParaExcluir;
    if (!alvo || !jogador) return;
    setExcluindo(true);
    try {
      const ok = await excluirPartida(alvo.id, jogador.id);
      if (ok) {
        setPartidas((prev) => prev.filter((p) => p.id !== alvo.id));
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
  if (erro)
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;

  return (
    <PullToRefresh onRefresh={carregar}>
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

      <Snackbar
        mensagem={snackbar.mensagem}
        tipo={snackbar.tipo}
        visivel={snackbar.visivel}
        onFechar={() => setSnackbar((s) => ({ ...s, visivel: false }))}
      />
    </PullToRefresh>
  );
}
