import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";
import type { JogadorLista } from "../lib/jogadores";
import { POSICOES } from "../lib/times";
import { formatarDataCompleta } from "../lib/formatacao";

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

  // Guard admin.
  if (!isAdmin) return <Navigate to="/" replace />;

  // Guard de state ausente (acesso direto/refresh): volta para a Etapa 1,
  // que rehidrata do localStorage e devolve o usuário pra cá com state.
  if (!estado || !Array.isArray(estado.selecionados)) {
    return <Navigate to="/partida/nova" replace />;
  }

  // Derivação dos jogadores selecionados agrupados por categoria.
  const grupos = useMemo(() => {
    const selecionadosDetalhados = estado.jogadores.filter((j) =>
      estado.selecionados.includes(j.id),
    );
    return {
      mensalistas: selecionadosDetalhados.filter(
        (j) => j.is_mensalista && j.posicao !== "goleiro",
      ),
      avulsos: selecionadosDetalhados.filter(
        (j) => !j.is_mensalista && j.posicao !== "goleiro",
      ),
      goleiros: selecionadosDetalhados.filter(
        (j) => j.posicao === "goleiro",
      ),
    };
  }, [estado]);

  const totalLinha = grupos.mensalistas.length + grupos.avulsos.length;
  const totalGoleiros = grupos.goleiros.length;

  // Data/hora para o resumo. dataJogo vem do input date (YYYY-MM-DD);
  // juntamos com horaJogo (HH:mm) padrão 19:00 em ISO local para formatar amigavelmente.
  const horaJogo = estado.horaJogo || "19:00";
  const dataHoraIso =
    estado.dataJogo
      ? `${estado.dataJogo}T${horaJogo}`
      : estado.dataJogo;
  const dataHoraTexto = dataHoraIso
    ? formatarDataCompleta(dataHoraIso)
    : `${estado.dataJogo} · ${horaJogo}`;


  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-neutral-500 dark:text-neutral-400 mb-2"
        >
          ← voltar
        </button>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Confirmar escalação
        </h2>
      </div>

      {/* Resumo: data/hora + totais */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
          {dataHoraTexto}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
            ✓ {totalLinha} de linha
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
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
        className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() =>
              navigate("/partida/nova/times", {
                state: {
                  selecionados: estado.selecionados,
                  jogadores: estado.jogadores,
                  dataJogo: estado.dataJogo,
                  horaJogo: estado.horaJogo,
                },
              })
            }
            className="w-full min-h-[44px] rounded-lg bg-destaque px-4 py-3 font-medium text-white active:scale-95 transition"
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
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {titulo}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
          {jogadores.length}
        </span>
      </div>
      <div className="px-3 py-3">
        {jogadores.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-600">
            Nenhum
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {jogadores.map((j) => (
              <span
                key={j.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm text-neutral-800 dark:text-neutral-200"
              >
                <span className="font-medium">{j.nome}</span>
                <span className="text-neutral-500 dark:text-neutral-400">
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
