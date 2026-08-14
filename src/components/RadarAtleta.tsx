import { useMemo } from "react";
import {
  Flame,
  Sparkles,
  Shield,
  Zap,
  Award,
  Activity,
  Trophy,
} from "lucide-react";

export interface AtletaStats {
  jogador_id?: number;
  partidas: number;
  vitorias: number;
  gols: number;
  assistencias: number;
  gols_contra?: number;
  media_nota?: number;
  posicao?: string;
  nome?: string;
}

interface RadarAtletaProps {
  stats: AtletaStats;
  compacto?: boolean;
}

interface ArquetipoInfo {
  titulo: string;
  subtitulo: string;
  descricao: string;
  corBadge: string;
  corBg: string;
  corBorda: string;
  icone: React.ElementType;
}

export function RadarAtleta({ stats, compacto = false }: RadarAtletaProps) {
  const { partidas, vitorias, gols, assistencias, media_nota, posicao } = stats;

  // 1. Cálculo dos 5 eixos (0 a 100)
  const metricas = useMemo(() => {
    const totalJogos = Math.max(1, partidas);

    // Eixo 1: Vitórias (Taxa de aproveitamento)
    const taxaVitorias = partidas > 0 ? (vitorias / totalJogos) * 100 : 0;
    const scoreVitorias = Math.min(100, Math.round(taxaVitorias));

    // Eixo 2: Gols (Média normalizada)
    const golsPorJogo = gols / totalJogos;
    const scoreGols = Math.min(100, Math.round(golsPorJogo * 50));

    // Eixo 3: Assistências (Média normalizada)
    const assistsPorJogo = assistencias / totalJogos;
    const scoreAssists = Math.min(100, Math.round(assistsPorJogo * 65));

    // Eixo 4: Presença (Assiduidade e rodagem)
    const scorePresenca = Math.min(100, Math.round(partidas * 8.5));

    // Eixo 5: Regularidade (Nota média ou consistência)
    let scoreRegularidade = 70;
    if (media_nota && media_nota > 0) {
      scoreRegularidade = Math.min(100, Math.round(media_nota * 10));
    } else if (partidas > 0) {
      scoreRegularidade = Math.min(
        100,
        Math.round((taxaVitorias * 0.6) + Math.min(40, (gols + assistencias) * 4))
      );
    }

    return [
      { chave: "vitorias", rotulo: "Vitórias", valor: scoreVitorias, display: `${Math.round(taxaVitorias)}%` },
      { chave: "gols", rotulo: "Gols", valor: scoreGols, display: `${golsPorJogo.toFixed(1)}/j` },
      { chave: "assists", rotulo: "Assists", valor: scoreAssists, display: `${assistsPorJogo.toFixed(1)}/j` },
      { chave: "presenca", rotulo: "Presença", valor: scorePresenca, display: `${partidas}j` },
      { chave: "regularidade", rotulo: "Regularidade", valor: scoreRegularidade, display: media_nota ? media_nota.toFixed(1) : `${scoreRegularidade}%` },
    ];
  }, [partidas, vitorias, gols, assistencias, media_nota]);

  // 2. Cálculo do OVR Score FIFA/EA FC (0 a 99)
  const ovrScore = useMemo(() => {
    if (partidas === 0) return 60;

    const vScore = metricas[0].valor * 0.25;
    const gScore = metricas[1].valor * 0.25;
    const aScore = metricas[2].valor * 0.20;
    const pScore = metricas[3].valor * 0.15;
    const rScore = metricas[4].valor * 0.15;

    const rawTotal = vScore + gScore + aScore + pScore + rScore;
    const ovr = Math.round(54 + (rawTotal * 0.45));
    return Math.min(99, Math.max(52, ovr));
  }, [metricas, partidas]);

  // 3. Determinação do Arquétipo de Atleta
  const arquetipo: ArquetipoInfo = useMemo(() => {
    const totalJogos = Math.max(1, partidas);
    const taxaVitorias = partidas > 0 ? vitorias / totalJogos : 0;
    const mediaGols = gols / totalJogos;
    const mediaAssists = assistencias / totalJogos;
    const gaPorJogo = (gols + assistencias) / totalJogos;

    if (posicao?.toLowerCase() === "goleiro") {
      return {
        titulo: "Muralha Intransponível",
        subtitulo: "Segurança debaixo das traves",
        descricao: "Paredão da zaga que fecha o ângulo e passa total confiança para a defesa.",
        corBadge: "text-blue-500 dark:text-blue-400",
        corBg: "bg-blue-500/10 dark:bg-blue-500/20",
        corBorda: "border-blue-500/30",
        icone: Shield,
      };
    }

    if (mediaGols >= 1.0 || gols >= 8) {
      return {
        titulo: "Matador Implacável",
        subtitulo: "Faro de gol & Oportunismo",
        descricao: "Finalizador nato com pontaria afiada, decide as partidas no detalhe dentro da área.",
        corBadge: "text-amber-500 dark:text-amber-400",
        corBg: "bg-amber-500/10 dark:bg-amber-500/20",
        corBorda: "border-amber-500/30",
        icone: Flame,
      };
    }

    if (mediaAssists >= 0.5 || assistencias >= 6) {
      return {
        titulo: "Maestro de Elite",
        subtitulo: "Visão & Passes Decisivos",
        descricao: "Comandante da meiuca, encontra companheiros livres com passes cirúrgicos que rasgam linhas.",
        corBadge: "text-emerald-500 dark:text-emerald-400",
        corBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        corBorda: "border-emerald-500/30",
        icone: Sparkles,
      };
    }

    if (taxaVitorias >= 0.65 && partidas >= 3) {
      return {
        titulo: "Pé de Coelho",
        subtitulo: "Amuleto das Vitórias",
        descricao: "Presença sinônimo de 3 pontos: onde pisa, o time sai de campo com o triunfo.",
        corBadge: "text-green-500 dark:text-green-400",
        corBg: "bg-green-500/10 dark:bg-green-500/20",
        corBorda: "border-green-500/30",
        icone: Trophy,
      };
    }

    if (gaPorJogo >= 1.2 && partidas >= 2) {
      return {
        titulo: "Motor Ofensivo",
        subtitulo: "Participação Direta Alta",
        descricao: "Onipresente no ataque, divide sua capacidade entre balançar as redes e servir os colegas.",
        corBadge: "text-orange-500 dark:text-orange-400",
        corBg: "bg-orange-500/10 dark:bg-orange-500/20",
        corBorda: "border-orange-500/30",
        icone: Zap,
      };
    }

    if (partidas >= 8) {
      return {
        titulo: "Guerreiro Incansável",
        subtitulo: "Frequência & Dedicação",
        descricao: "Pilar de regularidade e presença em todos os rachas, entrega tudo em campo até o apito final.",
        corBadge: "text-indigo-500 dark:text-indigo-400",
        corBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        corBorda: "border-indigo-500/30",
        icone: Activity,
      };
    }

    return {
      titulo: "Coringa Tático",
      subtitulo: "Equilíbrio & Versatilidade",
      descricao: "Atleta polivalente com bom senso de posicionamento e contribuição equilibrada ao elenco.",
      corBadge: "text-teal-500 dark:text-teal-400",
      corBg: "bg-teal-500/10 dark:bg-teal-500/20",
      corBorda: "border-teal-500/30",
      icone: Award,
    };
  }, [partidas, vitorias, gols, assistencias, posicao]);

  // 4. Geometria Pentagonal SVG
  const size = 230;
  const center = size / 2;
  const maxRadius = 78;
  const numSides = 5;

  // Ângulo inicial apontando para cima (-90 graus)
  const getCoordinates = (radius: number, index: number) => {
    const angle = (Math.PI * 2 * index) / numSides - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Níveis de grade (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Pontos do polígono do atleta
  const polygonPoints = useMemo(() => {
    return metricas
      .map((m, i) => {
        const r = Math.max(10, (m.valor / 100) * maxRadius);
        const { x, y } = getCoordinates(r, i);
        return `${x},${y}`;
      })
      .join(" ");
  }, [metricas]);

  const IconeArquetipo = arquetipo.icone;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 p-4 shadow-sm space-y-4">
      {/* Cabeçalho do Card: OVR + Arquétipo */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800/80 pb-3.5">
        {/* Badge FUT FIFA OVR */}
        <div className="flex items-center gap-3">
          <div className="relative flex flex-col items-center justify-center size-14 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 dark:from-amber-500 dark:to-amber-700 text-white font-extrabold shadow-md shadow-amber-500/20 ring-2 ring-amber-300/40 dark:ring-amber-500/30">
            <span className="font-scoreboard text-2xl leading-none tracking-tight">
              {ovrScore}
            </span>
            <span className="text-[9px] uppercase tracking-widest font-black opacity-90">
              OVR
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Perfil de Atleta
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>{arquetipo.titulo}</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {arquetipo.subtitulo}
            </p>
          </div>
        </div>

        {/* Badge de Arquétipo com Ícone */}
        <div
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${arquetipo.corBg} ${arquetipo.corBorda} ${arquetipo.corBadge}`}
        >
          <IconeArquetipo className="size-3.5" />
          <span className="hidden sm:inline">{posicao ? posicao.toUpperCase() : "LINHA"}</span>
        </div>
      </div>

      {/* Radar SVG Pentagonal */}
      <div className="relative flex flex-col items-center justify-center py-1">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[250px] aspect-square overflow-visible drop-shadow-xs"
        >
          <defs>
            <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.15" />
            </radialGradient>
            <linearGradient id="radarStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Grades concêntricas pentagonais */}
          {gridLevels.map((lvl) => {
            const points = Array.from({ length: numSides })
              .map((_, i) => {
                const { x, y } = getCoordinates(maxRadius * lvl, i);
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polygon
                key={lvl}
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth={lvl === 1.0 ? "1.5" : "1"}
                className="text-neutral-200 dark:text-neutral-800"
                strokeDasharray={lvl < 1.0 ? "3,3" : undefined}
              />
            );
          })}

          {/* Eixos do centro aos vértices */}
          {Array.from({ length: numSides }).map((_, i) => {
            const { x, y } = getCoordinates(maxRadius, i);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-neutral-200 dark:text-neutral-800"
              />
            );
          })}

          {/* Polígono de Desempenho do Atleta */}
          <polygon
            points={polygonPoints}
            fill="url(#radarFillGrad)"
            stroke="url(#radarStrokeGrad)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Pontos nos vértices com anel de destaque */}
          {metricas.map((m, i) => {
            const r = Math.max(10, (m.valor / 100) * maxRadius);
            const { x, y } = getCoordinates(r, i);
            return (
              <g key={m.chave}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className="dark:stroke-neutral-900 transition-all duration-700 ease-out"
                />
              </g>
            );
          })}

          {/* Rótulos dos eixos posicionados externamente */}
          {metricas.map((m, i) => {
            const labelRadius = maxRadius + 22;
            const { x, y } = getCoordinates(labelRadius, i);
            // Ajuste do alinhamento de texto baseado na posição horizontal
            let textAnchor: "middle" | "start" | "end" = "middle";
            if (i === 1 || i === 2) textAnchor = "start";
            if (i === 3 || i === 4) textAnchor = "end";

            return (
              <g key={`lbl-${m.chave}`} className="text-xs">
                <text
                  x={x}
                  y={y - 4}
                  textAnchor={textAnchor}
                  className="fill-neutral-600 dark:fill-neutral-300 font-bold text-[10px] uppercase tracking-wider"
                >
                  {m.rotulo}
                </text>
                <text
                  x={x}
                  y={y + 8}
                  textAnchor={textAnchor}
                  className="fill-amber-600 dark:fill-amber-400 font-extrabold text-[11px]"
                >
                  {m.display}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Descrição do Arquétipo */}
      <div
        className={`rounded-xl p-3 text-xs leading-relaxed border ${arquetipo.corBg} ${arquetipo.corBorda} text-neutral-700 dark:text-neutral-300`}
      >
        <p>{arquetipo.descricao}</p>
      </div>

      {/* Barras de Eficiência Tática */}
      {!compacto && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            <span>Eficiência Tática</span>
            <span>Aproveitamento</span>
          </div>

          <div className="space-y-2">
            <BarraEficiencia
              rotulo="Taxa de Vitórias"
              valor={`${partidas > 0 ? Math.round((vitorias / partidas) * 100) : 0}%`}
              porcentagem={partidas > 0 ? (vitorias / partidas) * 100 : 0}
              cor="bg-emerald-500"
            />
            <BarraEficiencia
              rotulo="Participação em Gols (G+A)"
              valor={`${partidas > 0 ? ((gols + assistencias) / partidas).toFixed(2) : "0"}/jogo`}
              porcentagem={Math.min(100, partidas > 0 ? (((gols + assistencias) / partidas) / 2) * 100 : 0)}
              cor="bg-amber-500"
            />
            <BarraEficiencia
              rotulo="Média de Gols"
              valor={`${partidas > 0 ? (gols / partidas).toFixed(2) : "0"}/jogo`}
              porcentagem={Math.min(100, partidas > 0 ? ((gols / partidas) / 1.5) * 100 : 0)}
              cor="bg-orange-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BarraEficiencia({
  rotulo,
  valor,
  porcentagem,
  cor,
}: {
  rotulo: string;
  valor: string;
  porcentagem: number;
  cor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {rotulo}
        </span>
        <span className="font-bold text-neutral-900 dark:text-neutral-100">
          {valor}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cor}`}
          style={{ width: `${Math.max(4, Math.min(100, porcentagem))}%` }}
        />
      </div>
    </div>
  );
}
