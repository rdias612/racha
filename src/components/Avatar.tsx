import { type PosicaoId, POSICOES } from "../lib/times";

interface AvatarProps {
  nome: string;
  posicao?: PosicaoId;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const COLOR_PALETTE = [
  "bg-emerald-600 text-white",
  "bg-green-600 text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-indigo-600 text-white",
  "bg-blue-600 text-white",
  "bg-violet-600 text-white",
  "bg-rose-600 text-white",
];

function getHashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index] ?? COLOR_PALETTE[0] ?? "bg-neutral-600 text-white";
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes[0] ?? "";
  if (partes.length === 0 || !primeiro) return "?";
  if (partes.length === 1) {
    return primeiro.slice(0, 2).toUpperCase();
  }
  const ultimo = partes[partes.length - 1] ?? "";
  return ((primeiro[0] ?? "") + (ultimo[0] ?? "")).toUpperCase() || "?";
}

const SIZE_CLASSES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export function Avatar({
  nome,
  posicao,
  size = "md",
  className = "",
}: AvatarProps) {
  const iniciais = getIniciais(nome);
  const corBg = getHashColor(nome);
  const sizeClass = SIZE_CLASSES[size];

  const siglaPosicao = posicao
    ? POSICOES[posicao]?.[0]?.toUpperCase() ?? null
    : null;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`rounded-full font-bold flex items-center justify-center shadow-sm ${sizeClass} ${corBg}`}
        title={nome}
      >
        {iniciais}
      </div>
      {siglaPosicao && posicao && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 font-bold px-1 text-[8px] leading-tight border border-white dark:border-neutral-900"
          title={POSICOES[posicao]}
        >
          {siglaPosicao}
        </span>
      )}
    </div>
  );
}
