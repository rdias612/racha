import { useEffect, useState } from "react";
import { Carregando, MensagemEstado } from "../components/Estado";
import { supabase } from "../lib/supabase";

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
  nome: string | null;
  valor: string;
  detalhe?: string;
}

export function Resumo() {
  const ano = new Date().getFullYear();
  const [resumo, setResumo] = useState<ResumoAno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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

  if (carregando) return <Carregando>Carregando resumo anual</Carregando>;
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
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Resumo de {ano}
        </h2>
        <MensagemEstado tipo="info" className="mt-3">
          Nenhuma partida publicada ainda neste ano.
        </MensagemEstado>
      </div>
    );
  }

  const destaques: DestaqueProps[] = [
    {
      titulo: "Artilheiro",
      nome: resumo.artilheiro_nome,
      valor: `${resumo.artilheiro_gols ?? 0} gols`,
      detalhe: `${resumo.artilheiro_partidas ?? 0} partidas`,
    },
    {
      titulo: "Maestro",
      nome: resumo.maestro_nome,
      valor: `${resumo.maestro_assistencias ?? 0} assistências`,
      detalhe: `${resumo.maestro_partidas ?? 0} partidas`,
    },
    {
      titulo: "O que importa é participar",
      nome: resumo.participante_nome,
      valor: `${resumo.participante_partidas ?? 0} partidas`,
    },
    {
      titulo: "Eficiente",
      nome: resumo.eficiente_nome,
      valor: `${Math.round((resumo.eficiente_percentual ?? 0) * 100)}% de vitórias`,
      detalhe: `${resumo.eficiente_vitorias ?? 0} vitórias em ${resumo.eficiente_partidas ?? 0} partidas`,
    },
    {
      titulo: "Maior sequência de vitórias",
      nome: resumo.sequencia_vitorias_nome,
      valor: `${resumo.sequencia_vitorias ?? 0} vitórias seguidas`,
    },
    {
      titulo: "Maior seca de vitórias",
      nome: resumo.seca_vitorias_nome,
      valor: `${resumo.seca_vitorias ?? 0} partidas sem vencer`,
    },
  ];

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 sm:mx-auto sm:max-w-2xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-(--cor-destaque)">
            Racha do ano
          </p>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Resumo de {ano}
          </h2>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {resumo.total_partidas} partidas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {destaques.map((destaque) => (
          <Destaque key={destaque.titulo} {...destaque} />
        ))}
      </div>
    </div>
  );
}

function Destaque({ titulo, nome, valor, detalhe }: DestaqueProps) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {titulo}
      </h3>
      <p className="mt-3 text-lg font-bold text-neutral-900 dark:text-neutral-100">
        {nome ?? "Sem vencedor"}
      </p>
      <p className="mt-1 text-sm font-medium text-(--cor-destaque)">{valor}</p>
      {detalhe && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {detalhe}
        </p>
      )}
    </section>
  );
}
