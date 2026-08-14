import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MensagemEstado } from "../components/Estado";
import { SkeletonResumo } from "../components/Skeletons";
import { BotaoInstalar } from "../components/BotaoInstalar";
import { supabase } from "../lib/supabase";
import {
  carregarParticipantes,
  vagasOcupadas,
  CAPACIDADE_PARTIDA,
} from "../lib/partidas";
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";
import { Trophy, Flame, Zap, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { vibrateLight } from "../lib/haptics";

interface ResumoAno {
  ano: number;
  total_partidas: number;
  artilheiro_jogador_id: number | null;
  artilheiro_nome: string | null;
  artilheiro_gols: number | null;
  artilheiro_partidas: number | null;
  maestro_jogador_id: number | null;
  maestro_nome: string | null;
  maestro_assistencias: number | null;
  maestro_partidas: number | null;
  participante_jogador_id: number | null;
  participante_nome: string | null;
  participante_partidas: number | null;
  eficiente_jogador_id: number | null;
  eficiente_nome: string | null;
  eficiente_vitorias: number | null;
  eficiente_partidas: number | null;
  eficiente_percentual: number | null;
  sequencia_vitorias_jogador_id: number | null;
  sequencia_vitorias_nome: string | null;
  sequencia_vitorias: number | null;
  seca_vitorias_jogador_id: number | null;
  seca_vitorias_nome: string | null;
  seca_vitorias: number | null;
}

interface DestaqueProps {
  titulo: string;
  subtitulo: string;
  nome: string | null;
  valor: string;
  detalhe?: string;
  icone: React.ReactNode;
}

export function Resumo() {
  const ano = new Date().getFullYear();
  const [resumo, setResumo] = useState<ResumoAno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [proxima, setProxima] = useState<{
    id: number;
    data_jogo: string;
    ocupadas: number;
  } | null>(null);

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase.rpc("resumo_ano", {
        p_ano: ano,
      });

      if (error) {
        setErro(error.message);
      } else {
        setResumo(data?.[0] ?? null);
      }
      setCarregando(false);
    }
    carregar();
  }, [ano]);

  useEffect(() => {
    async function carregarProxima() {
      try {
        const { data } = await supabase
          .from("partidas")
          .select("id, data_jogo, confirmacao_closes_at")
          .eq("status", "draft")
          .order("data_jogo", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!data) {
          setProxima(null);
          return;
        }
        const parts = await carregarParticipantes(data.id);
        const ocupadas = vagasOcupadas(parts, data.confirmacao_closes_at);
        setProxima({ id: data.id, data_jogo: data.data_jogo, ocupadas });
      } catch {
        setProxima(null);
      }
    }
    carregarProxima();
  }, []);

  if (carregando) return <SkeletonResumo />;
  if (erro) {
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );
  }
  if (!resumo || resumo.total_partidas === 0) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:mx-auto sm:max-w-2xl">
        <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
          Resumo da Temporada {ano}
        </h2>
        <CardProximaPartida proxima={proxima} />
        <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-6 text-center shadow-xs">
          <Trophy className="mx-auto size-10 text-neutral-400 dark:text-neutral-500 mb-2" />
          <h3 className="font-heading font-bold text-neutral-900 dark:text-neutral-100">
            Nenhum golaço registrado em {ano}!
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            A bola tá rolando ou tá rolando churrasco? Quando as primeiras partidas forem publicadas, a resenha completa dos craques aparece aqui.
          </p>
        </div>
      </div>
    );
  }

  const destaques: DestaqueProps[] = [
    {
      titulo: "Artilheiro Nato",
      subtitulo: "Terror dos goleiros",
      nome: resumo.artilheiro_nome,
      valor: `${resumo.artilheiro_gols ?? 0} gols`,
      detalhe: `${resumo.artilheiro_partidas ?? 0} jogos disputados`,
      icone: <Flame className="size-4 text-amber-500" />,
    },
    {
      titulo: "Garçom do Ano",
      subtitulo: "Pifou geral com classe",
      nome: resumo.maestro_nome,
      valor: `${resumo.maestro_assistencias ?? 0} assistências`,
      detalhe: `${resumo.maestro_partidas ?? 0} jogos disputados`,
      icone: <Zap className="size-4 text-amber-500" />,
    },
    {
      titulo: "Fominha de Plantão",
      subtitulo: "O que importa é participar",
      nome: resumo.participante_nome,
      valor: `${resumo.participante_partidas ?? 0} presenças`,
      detalhe: "Bateu o ponto no Gragoatá",
      icone: <ShieldCheck className="size-4 text-emerald-500" />,
    },
    {
      titulo: "Puro Suco de Eficiência",
      subtitulo: "Entra pra buscar vitória",
      nome: resumo.eficiente_nome,
      valor: `${Math.round((resumo.eficiente_percentual ?? 0) * 100)}% aproveitamento`,
      detalhe: `${resumo.eficiente_vitorias ?? 0} vitórias em ${resumo.eficiente_partidas ?? 0} jogos`,
      icone: <Trophy className="size-4 text-amber-400" />,
    },
    {
      titulo: "Na Crista da Onda",
      subtitulo: "Maior sequência invicta",
      nome: resumo.sequencia_vitorias_nome,
      valor: `${resumo.sequencia_vitorias ?? 0} vitórias seguidas`,
      detalhe: "Ninguém segurou a fera",
      icone: <TrendingUp className="size-4 text-emerald-500" />,
    },
    {
      titulo: "Seca Brava",
      subtitulo: "A redenção tá logo ali",
      nome: resumo.seca_vitorias_nome,
      valor: `${resumo.seca_vitorias ?? 0} jogos sem vencer`,
      detalhe: "Fase do bagre, mas vai passar!",
      icone: <AlertTriangle className="size-4 text-red-400" />,
    },
  ];

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl animate-page-enter">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-(--cor-destaque)">
            ⭐ Hall da Fama {ano}
          </p>
          <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
            Resenha da Temporada
          </h2>
        </div>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {resumo.total_partidas} {resumo.total_partidas === 1 ? "partida" : "partidas"} na súmula
        </p>
      </div>

      <BotaoInstalar />

      <CardProximaPartida proxima={proxima} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {destaques.map((destaque) => (
          <Destaque key={destaque.titulo} {...destaque} />
        ))}
      </div>
    </div>
  );
}

function Destaque({ titulo, subtitulo, nome, valor, detalhe, icone }: DestaqueProps) {
  return (
    <section className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60 transition-all hover:border-amber-400/40">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
            {titulo}
          </span>
          {icone}
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
          {subtitulo}
        </p>
        <p className="mt-2 text-base font-bold font-heading text-neutral-900 dark:text-neutral-100 truncate">
          {nome ?? "Sem dono ainda"}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
        <p className="text-xs font-extrabold text-(--cor-destaque)">{valor}</p>
        {detalhe && (
          <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
            {detalhe}
          </p>
        )}
      </div>
    </section>
  );
}

function CardProximaPartida({
  proxima,
}: {
  proxima: { id: number; data_jogo: string; ocupadas: number } | null;
}) {
  if (!proxima) return null;
  return (
    <Link
      to={`/partida/${proxima.id}`}
      onClick={() => vibrateLight()}
      className="mb-4 block rounded-xl border border-[var(--cor-destaque)]/40 bg-[var(--cor-destaque)]/10 px-4 py-3 shadow-xs hover:border-[var(--cor-destaque)] transition"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--cor-destaque)]">
          🔥 Próximo Racha · Convocação Aberta
        </p>
        <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
          {proxima.ocupadas}/{CAPACIDADE_PARTIDA} vagas
        </span>
      </div>
      <p className="mt-1 text-sm font-bold font-heading text-neutral-900 dark:text-neutral-100 capitalize">
        <span className="sm:hidden">{formatarDataMobile(proxima.data_jogo)}</span>
        <span className="hidden sm:inline">
          {formatarDataCompleta(proxima.data_jogo)}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
        Garanta sua presença antes que encerrem os convites!
      </p>
    </Link>
  );
}
