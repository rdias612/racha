import { type PosicaoId, POSICOES } from '../lib/times';

interface AvatarProps {
  username?: string;
  nome?: string;
  posicao?: PosicaoId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

// 6 tons terrosos noturnos da Súmula de Quinta
const COLOR_HEXES = [
  '#2f4a33', // campo
  '#8a5a2b', // couro
  '#7a2e2b', // tijolo
  '#54552e', // oliva
  '#31424e', // petróleo
  '#5b4632', // terra
];

function getHashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_HEXES.length;
  return COLOR_HEXES[index] ?? COLOR_HEXES[0] ?? '#2f4a33';
}

function getIniciais(identificador: string): string {
  const limpo = identificador.trim();
  if (!limpo) return '?';
  const partes = limpo.split(/\s+/);
  if (partes.length >= 2) {
    const primeiro = partes[0] ?? '';
    const ultimo = partes[partes.length - 1] ?? '';
    return ((primeiro[0] ?? '') + (ultimo[0] ?? '')).toUpperCase() || '?';
  }
  return limpo.slice(0, 2).toUpperCase();
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

export function Avatar({ username, nome, posicao, size = 'md', className = '' }: AvatarProps) {
  const idTexto = username || nome || '?';
  const iniciais = getIniciais(idTexto);
  const corBg = getHashColor(idTexto);
  const sizeClass = SIZE_CLASSES[size];

  const siglaPosicao = posicao ? (POSICOES[posicao]?.[0]?.toUpperCase() ?? null) : null;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`rounded-[3px] border border-borda/60 font-display font-bold flex items-center justify-center text-branco-time shadow-sm tracking-tight ${sizeClass}`}
        style={{ backgroundColor: corBg }}
        title={idTexto}
      >
        {iniciais}
      </div>
      {siglaPosicao && posicao && (
        <span
          className="absolute -bottom-1 -right-1 rounded-[2px] bg-branco-time text-preto-time font-display font-bold px-1 py-0 text-[8px] leading-tight border border-led-borda shadow-xs"
          title={POSICOES[posicao]}
        >
          {siglaPosicao}
        </span>
      )}
    </div>
  );
}
