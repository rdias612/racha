import { TIMES, type TimeId } from '../lib/times';
import type { Participante } from '../lib/partidas';
import { formatarNome } from '../lib/formatacao';

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
const VERDE_ESCURO = '#16281c';
const VERDE_CLARO = '#1b3323';

function ChipJogador({
  jogador,
  onClick,
  destaque,
}: {
  jogador: Participante;
  onClick?: (jogador: Participante) => void;
  destaque: boolean;
}) {
  const preto = jogador.time === 'a';
  const nome = formatarNome(jogador.nome ?? `#${jogador.jogador_id}`);
  const classe = `inline-flex max-w-[9.5rem] items-center justify-center truncate rounded-[3px] border px-2.5 text-[11px] font-display font-bold uppercase tracking-wider leading-none shadow-carimbo sm:text-xs ${
    preto ? 'border-[#35302a] text-[#f4f1e8]' : 'border-[#35302a] text-[#0d0d0e]'
  } ${destaque ? 'ring-2 ring-destaque ring-offset-2 ring-offset-[#16281c]' : ''}`;

  const estilo = {
    backgroundColor: TIMES[jogador.time ?? 'a'].cor,
    minHeight: '2.25rem',
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
      className={`${classe} cursor-pointer transition active:translate-y-px`}
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
  const xMeio = LARGURA / 2;
  const yMeio = COMPRIMENTO / 2;

  const faixas = 10;
  const hFaixa = COMPRIMENTO / faixas;

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${COMPRIMENTO}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Faixas de grama contextual */}
      {Array.from({ length: faixas }).map((_, i) => (
        <rect
          key={i}
          x={0}
          y={i * hFaixa}
          width={LARGURA}
          height={hFaixa}
          fill={i % 2 === 0 ? VERDE_ESCURO : VERDE_CLARO}
        />
      ))}

      {/* Linhas de marcação com cor campo-linha */}
      <g
        fill="none"
        stroke="#2c4433"
        strokeWidth="0.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {/* Linha externa */}
        <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} />

        {/* Linha de meio de campo */}
        <line x1={x1} y1={yMeio} x2={x2} y2={yMeio} />

        {/* Círculo central */}
        <circle cx={xMeio} cy={yMeio} r={RAIO_CENTRO} />
        <circle cx={xMeio} cy={yMeio} r={0.7} fill="#2c4433" />

        {/* Grande área superior (Time Preto) */}
        <path d={`M ${xPen} ${y1} V ${y1 + AREA_PENALTI_P} H ${xPen2} V ${y1}`} />
        {/* Pequena área superior */}
        <path d={`M ${xGol} ${y1} V ${y1 + AREA_GOL_P} H ${xGol2} V ${y1}`} />
        {/* Ponto penal superior */}
        <circle cx={xMeio} cy={y1 + MARCA_PENALTI} r={0.7} fill="#2c4433" />
        {/* Meia-lua superior */}
        <path
          d={`M ${xMeio - 7.3} ${y1 + AREA_PENALTI_P} A ${RAIO_CENTRO} ${RAIO_CENTRO} 0 0 0 ${xMeio + 7.3} ${y1 + AREA_PENALTI_P}`}
        />

        {/* Grande área inferior (Time Branco) */}
        <path d={`M ${xPen} ${y2} V ${y2 - AREA_PENALTI_P} H ${xPen2} V ${y2}`} />
        {/* Pequena área inferior */}
        <path d={`M ${xGol} ${y2} V ${y2 - AREA_GOL_P} H ${xGol2} V ${y2}`} />
        {/* Ponto penal inferior */}
        <circle cx={xMeio} cy={y2 - MARCA_PENALTI} r={0.7} fill="#2c4433" />
        {/* Meia-lua inferior */}
        <path
          d={`M ${xMeio - 7.3} ${y2 - AREA_PENALTI_P} A ${RAIO_CENTRO} ${RAIO_CENTRO} 0 0 1 ${xMeio + 7.3} ${y2 - AREA_PENALTI_P}`}
        />
      </g>
    </svg>
  );
}

function MetadeCampo({
  time,
  participantes,
  onJogadorClick,
  jogadorDestaqueId,
  invertido,
}: {
  time: TimeId;
  participantes: Participante[];
  onJogadorClick?: (jogador: Participante) => void;
  jogadorDestaqueId?: number | null;
  invertido?: boolean;
}) {
  const doTime = participantes.filter((p) => p.time === time);
  const goleiros = doTime.filter((p) => p.posicao === 'goleiro');
  const defensores = doTime.filter((p) => p.posicao === 'zagueiro' || p.posicao === 'lateral');
  const meias = doTime.filter((p) => p.posicao === 'meia');
  const atacantes = doTime.filter((p) => p.posicao === 'atacante' || p.posicao === 'random');

  const linhas = [
    { key: 'gol', jogs: goleiros },
    { key: 'def', jogs: defensores },
    { key: 'mei', jogs: meias },
    { key: 'ata', jogs: atacantes },
  ];

  const ordem = invertido ? [...linhas].reverse() : linhas;

  return (
    <div className="relative flex flex-1 flex-col justify-around py-3">
      {ordem.map(({ key, jogs }) => (
        <GrupoJogadores
          key={key}
          jogadores={jogs}
          onClick={onJogadorClick}
          destaqueId={jogadorDestaqueId}
          className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 px-2"
        />
      ))}
    </div>
  );
}

export function CampoPartida({
  participantes,
  placar,
  onJogadorClick,
  jogadorDestaqueId,
}: CampoPartidaProps) {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[4px] border-2 border-borda shadow-carimbo-preto">
      {/* Campo com proporção realista 68:105 (aspect-[68/105]) */}
      <div className="relative aspect-[68/105] w-full">
        <MarcacoesCampo />

        <div className="absolute inset-0 flex flex-col">
          {/* Metade Superior: Time Preto */}
          <MetadeCampo
            time="a"
            participantes={participantes}
            onJogadorClick={onJogadorClick}
            jogadorDestaqueId={jogadorDestaqueId}
          />

          {/* Faixa central de placar LED */}
          <div className="relative z-10 flex items-center justify-center py-1">
            <div className="flex items-center gap-3 rounded-[3px] border border-borda bg-[#000000] px-4 py-1 font-display font-black text-white shadow-carimbo-preto">
              <span className="text-xs uppercase tracking-wider text-[#f4f1e8]">Preto</span>
              <span className="font-mono text-base font-black text-destaque tabular-nums">
                {placar.gols_time_a} × {placar.gols_time_b}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#f4f1e8]">Branco</span>
            </div>
          </div>

          {/* Metade Inferior: Time Branco (invertido para gol ficar embaixo) */}
          <MetadeCampo
            time="b"
            participantes={participantes}
            onJogadorClick={onJogadorClick}
            jogadorDestaqueId={jogadorDestaqueId}
            invertido
          />
        </div>
      </div>
    </div>
  );
}
