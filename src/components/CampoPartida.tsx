import type { TimeId } from "../lib/times";
import type { Participante } from "../lib/partidas";
import { formatarNome } from "../lib/formatacao";
import { vibrateLight } from "../lib/haptics";

interface CampoPartidaProps {
  participantes: Participante[];
  placar: { gols_time_a: number; gols_time_b: number };
  onJogadorClick?: (jogador: Participante) => void;
  jogadorDestaqueId?: number | null;
}

/** FIFA standard field dimensions (scaled): 105 × 68 m */
const COMPRIMENTO = 105;
const LARGURA = 68;
const AREA_PENALTI_L = 40.32;
const AREA_PENALTI_P = 16.5;
const AREA_GOL_L = 18.32;
const AREA_GOL_P = 5.5;
const RAIO_CENTRO = 9.15;
const MARCA_PENALTI = 11;
const LARGURA_GOL = 7.32;

function ChipJogador({
  jogador,
  onClick,
  destaque,
}: {
  jogador: Participante;
  onClick?: (jogador: Participante) => void;
  destaque: boolean;
}) {
  const preto = jogador.time === "a";
  const nome = formatarNome(jogador.nome ?? `#${jogador.jogador_id}`);
  const temGols = (jogador.gols ?? 0) > 0;
  const temAssists = (jogador.assistencias ?? 0) > 0;

  const baseClasses = `inline-flex min-h-[44px] min-w-[44px] max-w-[10.5rem] items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold leading-tight shadow-lg transition-all ${
    preto
      ? "border border-neutral-700 bg-neutral-950 text-white shadow-neutral-950/40"
      : "border border-neutral-300 bg-white text-neutral-950 shadow-black/20"
  } ${
    destaque
      ? "ring-3 ring-amber-400 ring-offset-2 ring-offset-green-950 scale-105"
      : "hover:scale-[1.02]"
  }`;

  const conteudo = (
    <>
      <span className="truncate">{nome}</span>
      {(temGols || temAssists) && (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-black">
          {temGols && <span title={`${jogador.gols} gol(s)`}>⚽{jogador.gols > 1 ? jogador.gols : ""}</span>}
          {temAssists && <span title={`${jogador.assistencias} assist(s)`}>🅰️</span>}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <span className={baseClasses}>{conteudo}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        vibrateLight();
        onClick(jogador);
      }}
      className={`${baseClasses} cursor-pointer active:scale-95`}
    >
      {conteudo}
    </button>
  );
}

function GrupoJogadores({
  jogadores,
  onClick,
  destaqueId,
  className,
}: {
  jogadores: Participante[];
  onClick?: (jogador: Participante) => void;
  destaqueId?: number | null;
  className: string;
}) {
  if (jogadores.length === 0) return null;
  return (
    <div className={className}>
      {jogadores.map((jogador) => (
        <ChipJogador
          key={jogador.jogador_id}
          jogador={jogador}
          onClick={onClick}
          destaque={destaqueId === jogador.jogador_id}
        />
      ))}
    </div>
  );
}

function MarcacoesCampo() {
  const pad = 1.0;
  const x1 = pad;
  const y1 = pad;
  const x2 = LARGURA - pad;
  const y2 = COMPRIMENTO - pad;
  const xPen = (LARGURA - AREA_PENALTI_L) / 2;
  const xPen2 = xPen + AREA_PENALTI_L;
  const xGol = (LARGURA - AREA_GOL_L) / 2;
  const xGol2 = xGol + AREA_GOL_L;
  const xTrave1 = (LARGURA - LARGURA_GOL) / 2;
  const meio = COMPRIMENTO / 2;
  const cx = LARGURA / 2;

  const linha = {
    fill: "none",
    stroke: "rgba(255, 255, 255, 0.88)",
    strokeWidth: 0.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const redeGol = {
    fill: "rgba(255, 255, 255, 0.12)",
    stroke: "rgba(255, 255, 255, 0.75)",
    strokeWidth: 0.4,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${LARGURA} ${COMPRIMENTO}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Padrão sutil do gramado */}
        <pattern id="turfPattern" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="5" fill="#15803d" opacity="0.15" />
          <rect y="5" width="10" height="5" fill="#166534" opacity="0.15" />
        </pattern>
      </defs>

      {/* Redes de Gol externas */}
      <rect x={xTrave1} y={0} width={LARGURA_GOL} height={pad} {...redeGol} />
      <rect x={xTrave1} y={y2} width={LARGURA_GOL} height={pad} {...redeGol} />

      {/* Linhas limites do campo */}
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} {...linha} />

      {/* Meio de Campo */}
      <line x1={x1} y1={meio} x2={x2} y2={meio} {...linha} />
      <circle cx={cx} cy={meio} r={RAIO_CENTRO} {...linha} />
      <circle cx={cx} cy={meio} r="0.55" fill="white" stroke="none" />

      {/* Escanteios (Arco de 1m) */}
      <path d={`M ${x1} ${y1 + 1.8} A 1.8 1.8 0 0 0 ${x1 + 1.8} ${y1}`} {...linha} />
      <path d={`M ${x2 - 1.8} ${y1} A 1.8 1.8 0 0 0 ${x2} ${y1 + 1.8}`} {...linha} />
      <path d={`M ${x1} ${y2 - 1.8} A 1.8 1.8 0 0 1 ${x1 + 1.8} ${y2}`} {...linha} />
      <path d={`M ${x2 - 1.8} ${y2} A 1.8 1.8 0 0 1 ${x2} ${y2 - 1.8}`} {...linha} />

      {/* Grande Área e Pequena Área Superior */}
      <path
        d={`M ${xPen} ${y1} L ${xPen} ${y1 + AREA_PENALTI_P} L ${xPen2} ${y1 + AREA_PENALTI_P} L ${xPen2} ${y1}`}
        {...linha}
      />
      <path
        d={`M ${xGol} ${y1} L ${xGol} ${y1 + AREA_GOL_P} L ${xGol2} ${y1 + AREA_GOL_P} L ${xGol2} ${y1}`}
        {...linha}
      />
      <circle cx={cx} cy={y1 + MARCA_PENALTI} r="0.45" fill="white" stroke="none" />
      {/* Meia-lua superior */}
      <path
        d={`M ${cx - 7.3} ${y1 + AREA_PENALTI_P} A ${RAIO_CENTRO} ${RAIO_CENTRO} 0 0 0 ${cx + 7.3} ${y1 + AREA_PENALTI_P}`}
        {...linha}
      />

      {/* Grande Área e Pequena Área Inferior */}
      <path
        d={`M ${xPen} ${y2} L ${xPen} ${y2 - AREA_PENALTI_P} L ${xPen2} ${y2 - AREA_PENALTI_P} L ${xPen2} ${y2}`}
        {...linha}
      />
      <path
        d={`M ${xGol} ${y2} L ${xGol} ${y2 - AREA_GOL_P} L ${xGol2} ${y2 - AREA_GOL_P} L ${xGol2} ${y2}`}
        {...linha}
      />
      <circle cx={cx} cy={y2 - MARCA_PENALTI} r="0.45" fill="white" stroke="none" />
      {/* Meia-lua inferior */}
      <path
        d={`M ${cx - 7.3} ${y2 - AREA_PENALTI_P} A ${RAIO_CENTRO} ${RAIO_CENTRO} 0 0 1 ${cx + 7.3} ${y2 - AREA_PENALTI_P}`}
        {...linha}
      />
    </svg>
  );
}

function metade(participantes: Participante[], time: TimeId) {
  const doTime = participantes.filter((p) => p.time === time);
  const goleiros = doTime
    .filter((p) => p.posicao === "goleiro")
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"));
  const linha = doTime
    .filter((p) => p.posicao !== "goleiro")
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"));
  return { goleiros, linha };
}

export function CampoPartida({
  participantes,
  placar,
  onJogadorClick,
  jogadorDestaqueId,
}: CampoPartidaProps) {
  const branco = metade(participantes, "b");
  const preto = metade(participantes, "a");

  const areaGoleiro =
    "absolute left-[15%] z-10 flex w-[70%] items-center justify-center px-1";
  const areaLinha =
    "absolute inset-x-2 z-10 flex flex-wrap content-center justify-center gap-2";

  return (
    <div className="mx-auto w-full max-w-[24rem] sm:max-w-[27rem]">
      {/* Campinho com Estética de Gramado Profissional */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border-4 border-green-950 shadow-2xl"
        style={{
          aspectRatio: `${LARGURA} / ${COMPRIMENTO}`,
          backgroundColor: "#166534",
          backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15)),
            repeating-linear-gradient(
              180deg,
              #15803d 0%,
              #15803d 9.09%,
              #166534 9.09%,
              #166534 18.18%
            )
          `,
        }}
      >
        {/* Iluminação de Estádio / Efeito Vinheta */}
        <div className="pointer-events-none absolute inset-0 bg-radial-at-c from-white/10 via-transparent to-black/40" />

        <MarcacoesCampo />

        {/* Time Branco (Superior) */}
        <GrupoJogadores
          jogadores={branco.goleiros}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaGoleiro} top-[4.5%] min-h-[48px]`}
        />
        <GrupoJogadores
          jogadores={branco.linha}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaLinha} top-[16%] min-h-[110px]`}
        />

        {/* Placar Central com Bebas Neue e Estilo Estádio */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-neutral-700/80 bg-neutral-950/85 shadow-2xl backdrop-blur-md">
          <div className="flex items-center px-4 py-1.5 font-scoreboard">
            {/* Gols Time Branco (B) */}
            <div className="flex items-center justify-center pr-3">
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-white drop-shadow-md">
                {placar.gols_time_b}
              </span>
            </div>

            {/* Separador */}
            <span className="text-sm font-black text-amber-400">×</span>

            {/* Gols Time Preto (A) */}
            <div className="flex items-center justify-center pl-3">
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-white drop-shadow-md">
                {placar.gols_time_a}
              </span>
            </div>
          </div>
        </div>

        {/* Time Preto (Inferior) */}
        <GrupoJogadores
          jogadores={preto.linha}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaLinha} bottom-[16%] min-h-[110px]`}
        />
        <GrupoJogadores
          jogadores={preto.goleiros}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaGoleiro} bottom-[4.5%] min-h-[48px]`}
        />
      </div>
    </div>
  );
}
