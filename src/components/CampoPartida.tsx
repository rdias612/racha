import { TIMES, type TimeId } from "../lib/times";
import type { Participante } from "../lib/partidas";
import { formatarNome } from "../lib/formatacao";

interface CampoPartidaProps {
  participantes: Participante[];
  placar: { gols_time_a: number; gols_time_b: number };
  onJogadorClick?: (jogador: Participante) => void;
  jogadorDestaqueId?: number | null;
}

/** FIFA: 105 × 68 m (dentro de 100–110 × 64–75). Unidades = metros. */
const COMPRIMENTO = 105;
const LARGURA = 68;
const AREA_PENALTI_L = 40.32;
const AREA_PENALTI_P = 16.5;
const AREA_GOL_L = 18.32;
const AREA_GOL_P = 5.5;
const RAIO_CENTRO = 9.15;
const MARCA_PENALTI = 11;
const VERDE_ESCURO = "#1f7a3d";
const VERDE_CLARO = "#259348";

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
  const classe = `inline-flex max-w-[9.5rem] items-center justify-center truncate rounded-sm border px-2.5 text-[11px] font-semibold leading-none shadow-md sm:text-xs ${
    preto
      ? "border-neutral-700 text-neutral-50"
      : "border-neutral-300 text-neutral-900"
  } ${destaque ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-transparent" : ""}`;

  const estilo = {
    backgroundColor: TIMES[jogador.time ?? "a"].cor,
    minHeight: "2.25rem",
  } as const;

  if (!onClick) {
    return (
      <span className={classe} style={estilo}>
        {nome}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(jogador)}
      className={`${classe} cursor-pointer transition active:scale-95`}
      style={estilo}
    >
      {nome}
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
  const pad = 0.7;
  const x1 = pad;
  const y1 = pad;
  const x2 = LARGURA - pad;
  const y2 = COMPRIMENTO - pad;
  const xPen = (LARGURA - AREA_PENALTI_L) / 2;
  const xPen2 = xPen + AREA_PENALTI_L;
  const xGol = (LARGURA - AREA_GOL_L) / 2;
  const xGol2 = xGol + AREA_GOL_L;
  const meio = COMPRIMENTO / 2;
  const cx = LARGURA / 2;

  const linha = {
    fill: "none",
    stroke: "rgba(255,255,255,0.9)",
    strokeWidth: 0.32,
    strokeLinecap: "butt" as const,
    strokeLinejoin: "miter" as const,
    strokeMiterlimit: 4,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${LARGURA} ${COMPRIMENTO}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} {...linha} />

      <line x1={x1} y1={meio} x2={x2} y2={meio} {...linha} />
      <circle cx={cx} cy={meio} r={RAIO_CENTRO} {...linha} />
      <circle cx={cx} cy={meio} r="0.38" fill="white" stroke="none" />

      {/* Áreas em U: encostam na linha de fundo, sem redesenhar o fundo. */}
      <path
        d={`M ${xPen} ${y1} L ${xPen} ${y1 + AREA_PENALTI_P} L ${xPen2} ${y1 + AREA_PENALTI_P} L ${xPen2} ${y1}`}
        {...linha}
      />
      <path
        d={`M ${xGol} ${y1} L ${xGol} ${y1 + AREA_GOL_P} L ${xGol2} ${y1 + AREA_GOL_P} L ${xGol2} ${y1}`}
        {...linha}
      />
      <circle cx={cx} cy={y1 + MARCA_PENALTI} r="0.35" fill="white" stroke="none" />

      <path
        d={`M ${xPen} ${y2} L ${xPen} ${y2 - AREA_PENALTI_P} L ${xPen2} ${y2 - AREA_PENALTI_P} L ${xPen2} ${y2}`}
        {...linha}
      />
      <path
        d={`M ${xGol} ${y2} L ${xGol} ${y2 - AREA_GOL_P} L ${xGol2} ${y2 - AREA_GOL_P} L ${xGol2} ${y2}`}
        {...linha}
      />
      <circle cx={cx} cy={y2 - MARCA_PENALTI} r="0.35" fill="white" stroke="none" />
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
    "absolute left-[20.35%] z-10 flex w-[59.3%] items-center justify-center px-1";
  const areaLinha =
    "absolute inset-x-1 z-10 flex flex-wrap content-center justify-center gap-1.5";

  return (
    <div className="mx-auto w-full max-w-[22.5rem] sm:max-w-[24rem]">
      <div
        className="relative w-full overflow-hidden rounded-lg border-2 border-green-950 shadow-inner"
        style={{
          aspectRatio: `${LARGURA} / ${COMPRIMENTO}`,
          backgroundColor: VERDE_ESCURO,
          backgroundImage: `repeating-linear-gradient(180deg, ${VERDE_ESCURO} 0%, ${VERDE_ESCURO} 9.09%, ${VERDE_CLARO} 9.09%, ${VERDE_CLARO} 18.18%)`,
        }}
      >
        <MarcacoesCampo />

        <GrupoJogadores
          jogadores={branco.goleiros}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaGoleiro} top-[7.5%] h-[7.5%]`}
        />
        <GrupoJogadores
          jogadores={branco.linha}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaLinha} top-[16.5%] h-[23.5%]`}
        />

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[7.5rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm shadow-md sm:w-[8.5rem]">
          <div className="grid grid-cols-2">
            <div
              className="flex items-center justify-end py-1 pr-3.5 pl-2"
              style={{ backgroundColor: "rgba(249,250,251,0.72)" }}
            >
              <span className="text-base font-bold tabular-nums text-neutral-900 sm:text-lg">
                {placar.gols_time_b}
              </span>
            </div>
            <div
              className="flex items-center justify-start py-1 pl-3.5 pr-2"
              style={{ backgroundColor: "rgba(17,24,39,0.72)" }}
            >
              <span className="text-base font-bold tabular-nums text-white sm:text-lg">
                {placar.gols_time_a}
              </span>
            </div>
          </div>
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-black text-white"
            style={{ WebkitTextStroke: "0.7px #111827" }}
          >
            ×
          </span>
        </div>

        <GrupoJogadores
          jogadores={preto.linha}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaLinha} bottom-[16.5%] h-[23.5%]`}
        />
        <GrupoJogadores
          jogadores={preto.goleiros}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className={`${areaGoleiro} bottom-[7.5%] h-[7.5%]`}
        />
      </div>
    </div>
  );
}
