import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";
import { Carregando, MensagemEstado } from "../components/Estado";
import { formatarDataLista } from "../lib/formatacao";
import {
  STATUS_COR,
  STATUS_LABEL,
  listarJogosComPlacar,
  type JogoComPlacar,
} from "../lib/partidas";
import { PullToRefresh } from "../components/PullToRefresh";
import { vibrateLight } from "../lib/haptics";
import { Radio, Calendar } from "lucide-react";

export function Jogos() {
  const isAdmin = useAdmin();
  const [jogos, setJogos] = useState<JogoComPlacar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const data = await listarJogosComPlacar();
      setJogos(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErro(err?.message ?? String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) return <Carregando>Carregando histórico de jogos</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );

  return (
    <PullToRefresh onRefresh={carregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
              Calendário &amp; Jogos
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Histórico de confrontos e partidas ao vivo
            </p>
          </div>
          {isAdmin && (
            <Link
              to="/partida/nova"
              onClick={() => vibrateLight()}
              className="text-xs font-bold rounded-xl bg-[var(--cor-destaque)] text-white px-3.5 py-2 shadow-xs active:scale-95 transition"
            >
              + Nova partida
            </Link>
          )}
        </div>

        {jogos.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-6 text-center shadow-xs">
            <Calendar className="mx-auto size-10 text-neutral-400 mb-2" />
            <h3 className="font-heading font-bold text-neutral-900 dark:text-neutral-100">
              Nenhum jogo na súmula ainda!
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {isAdmin
                ? 'Bora marcar o primeiro racha da temporada! Toque em "+ Nova partida" para começar a resenha.'
                : "A bola tá parada! Assim que a comissão técnica agendar o próximo confronto, ele aparece aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {jogos.map((p) => {
              const pl = p.placar;
              const isLive = p.status === "live";
              return (
                <Link
                  key={p.id}
                  to={
                    isLive
                      ? `/partida/${p.id}/ao-vivo`
                      : `/partida/${p.id}`
                  }
                  onClick={() => vibrateLight()}
                  className={`block rounded-2xl border bg-white dark:bg-neutral-900/80 p-3.5 shadow-xs transition hover:border-[var(--cor-destaque)] active:scale-[0.99] ${
                    isLive
                      ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {formatarDataLista(p.data_jogo)}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/40">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-live-pulse" />
                        <Radio className="size-3" />
                        Ao Vivo
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COR[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    )}
                  </div>

                  {/* Placar estilo estádio mini */}
                  <div className="mt-2 flex items-center justify-center gap-4 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full border border-neutral-700 bg-neutral-950" />
                      <span className="font-heading text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300">
                        Preto
                      </span>
                    </div>

                    <div className="font-scoreboard flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 px-3 py-1 text-2xl font-black tabular-nums text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800">
                      <span>{p.status === "draft" || !pl ? "—" : pl.gols_time_a}</span>
                      <span className="text-sm font-bold text-amber-500">×</span>
                      <span>{p.status === "draft" || !pl ? "—" : pl.gols_time_b}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-heading text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300">
                        Branco
                      </span>
                      <span className="size-2.5 rounded-full border border-neutral-300 bg-white" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
