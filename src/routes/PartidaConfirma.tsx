import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import type { JogadorLista } from '../lib/jogadores';
import { POSICOES } from '../lib/times';
import { formatarDataCompleta } from '../lib/formatacao';
import { BotaoVoltar } from '../components/BotaoVoltar';

interface EstadoPartida {
  selecionados: number[];
  jogadores: JogadorLista[];
  dataJogo: string;
  horaJogo?: string;
}

export function PartidaConfirma() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = location.state as EstadoPartida | null;

  // Derivação dos jogadores selecionados agrupados por categoria.
  const grupos = useMemo(() => {
    if (!estado || !Array.isArray(estado.selecionados) || !Array.isArray(estado.jogadores)) {
      return { mensalistas: [], avulsos: [], goleiros: [] };
    }
    const selecionadosDetalhados = estado.jogadores.filter((j) =>
      estado.selecionados.includes(j.id)
    );
    return {
      mensalistas: selecionadosDetalhados.filter((j) => j.is_mensalista && j.posicao !== 'goleiro'),
      avulsos: selecionadosDetalhados.filter((j) => !j.is_mensalista && j.posicao !== 'goleiro'),
      goleiros: selecionadosDetalhados.filter((j) => j.posicao === 'goleiro'),
    };
  }, [estado]);

  // Guard admin.
  if (!isAdmin) return <Navigate to="/" replace />;

  // Guard de state ausente (acesso direto/refresh): volta para a Etapa 1,
  // que rehidrata do localStorage e devolve o usuário pra cá com state.
  if (!estado || !Array.isArray(estado.selecionados) || !Array.isArray(estado.jogadores)) {
    return <Navigate to="/partida/nova" replace />;
  }

  const totalLinha = grupos.mensalistas.length + grupos.avulsos.length;
  const totalGoleiros = grupos.goleiros.length;

  // Data/hora para o resumo. dataJogo vem do input date (YYYY-MM-DD);
  // juntamos com horaJogo (HH:mm) padrão 19:00 em ISO local para formatar amigavelmente.
  const horaJogo = estado.horaJogo || '19:00';
  const dataHoraIso = estado.dataJogo ? `${estado.dataJogo}T${horaJogo}` : estado.dataJogo;
  const dataHoraTexto = dataHoraIso
    ? formatarDataCompleta(dataHoraIso)
    : `${estado.dataJogo} · ${horaJogo}`;

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto text-giz">
      <div>
        <BotaoVoltar fallback="/partida/nova" className="mb-2" />
        <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz sumula-header pb-2">
          Confirmar escalação da súmula
        </h2>
      </div>

      {/* Resumo: data/hora + totais */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3 space-y-3 shadow-carimbo">
        <p className="text-sm font-bold text-giz capitalize">{dataHoraTexto}</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-display font-bold uppercase tracking-wider text-ok">
            ✓ {totalLinha} de linha
          </span>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-display font-bold uppercase tracking-wider text-ok">
            ✓ {totalGoleiros} goleiros
          </span>
        </div>
      </section>

      {/* Grupos */}
      <GrupoConfirma titulo="Mensalistas" jogadores={grupos.mensalistas} />
      <GrupoConfirma titulo="Avulsos" jogadores={grupos.avulsos} />
      <GrupoConfirma titulo="Goleiros" jogadores={grupos.goleiros} />

      {/* CTA fixo inferior */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() =>
              navigate('/partida/nova/times', {
                state: {
                  selecionados: estado.selecionados,
                  jogadores: estado.jogadores,
                  dataJogo: estado.dataJogo,
                  horaJogo: estado.horaJogo,
                },
              })
            }
            className="w-full min-h-[44px] rounded-[4px] bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo active:translate-y-px transition cursor-pointer"
          >
            Confirmar e ir para times
          </button>
        </div>
      </div>
    </div>
  );
}

interface GrupoConfirmaProps {
  titulo: string;
  jogadores: JogadorLista[];
}

function GrupoConfirma({ titulo, jogadores }: GrupoConfirmaProps) {
  return (
    <section className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo">
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-borda bg-superficie-2">
        <span className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          {titulo}
        </span>
        <span className="text-xs font-mono font-bold text-giz-fraco tabular-nums">
          {jogadores.length}
        </span>
      </div>
      <div className="px-3 py-3">
        {jogadores.length === 0 ? (
          <p className="text-xs font-mono text-giz-fraco">Nenhum jogador</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {jogadores.map((j) => (
              <span
                key={j.id}
                className="inline-flex items-center gap-1.5 rounded-[2px] bg-superficie-2 border border-borda px-2.5 py-1 text-xs text-giz"
              >
                <span className="font-bold">{j.username}</span>
                <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                  {POSICOES[j.posicao]}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
