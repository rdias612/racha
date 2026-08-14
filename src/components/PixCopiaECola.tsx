import { useState } from "react";
import { Copy, Check, QrCode, MessageCircle, Settings, KeyRound } from "lucide-react";
import { formatarReais } from "../lib/formatacao";
import type { Divida } from "../lib/dividas";

const CHAVE_PIX_STORAGE_KEY = "racha_chave_pix";
const CHAVE_PIX_PADRAO = "racha.gragoata@gmail.com";

export function obterChavePix(): string {
  if (typeof window === "undefined") return CHAVE_PIX_PADRAO;
  return localStorage.getItem(CHAVE_PIX_STORAGE_KEY) || CHAVE_PIX_PADRAO;
}

export function salvarChavePix(novaChave: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE_PIX_STORAGE_KEY, novaChave.trim());
}

/** Formata campo EMV (ID + Tamanho 2 dígitos + Valor) */
function formatarEMV(id: string, valor: string): string {
  const len = valor.length.toString().padStart(2, "0");
  return `${id}${len}${valor}`;
}

/** Cálculo do CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF) */
function crc16(dados: string): string {
  let crc = 0xffff;
  for (let i = 0; i < dados.length; i++) {
    crc ^= dados.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface GerarPayloadPixParams {
  chave: string;
  nomeRecebedor?: string;
  cidade?: string;
  valor?: number;
  txid?: string;
}

/** Gera o payload do Pix Copia e Cola no padrão oficial do Banco Central (BR Code / EMV QRCPS) */
export function gerarPayloadPix({
  chave,
  nomeRecebedor = "RACHA FC",
  cidade = "NITEROI",
  valor,
  txid = "***",
}: GerarPayloadPixParams): string {
  const chaveLimpa = chave.trim();
  // Normaliza removendo acentos e caracteres especiais para compatibilidade com o padrão EMV
  const nomeLimpo = nomeRecebedor
    .trim()
    .slice(0, 25)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const cidadeLimpa = cidade
    .trim()
    .slice(0, 15)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const gui = formatarEMV("00", "br.gov.bcb.pix");
  const key = formatarEMV("01", chaveLimpa);
  const merchantAccountInfo = formatarEMV("26", gui + key);

  const payloadFormat = formatarEMV("00", "01");
  const merchantCategory = formatarEMV("52", "0000");
  const transactionCurrency = formatarEMV("53", "986");
  const transactionAmount =
    valor && valor > 0 ? formatarEMV("54", valor.toFixed(2)) : "";
  const countryCode = formatarEMV("58", "BR");
  const merchantName = formatarEMV("59", nomeLimpo || "RACHA");
  const merchantCity = formatarEMV("60", cidadeLimpa || "NITEROI");
  const additionalData = formatarEMV("62", formatarEMV("05", txid || "***"));

  const raw = `${payloadFormat}${merchantAccountInfo}${merchantCategory}${transactionCurrency}${transactionAmount}${countryCode}${merchantName}${merchantCity}${additionalData}6304`;
  const checksum = crc16(raw);
  return `${raw}${checksum}`;
}

export interface MensagemCobrancaParams {
  nome: string;
  valor: number;
  dividas?: Divida[];
  chavePix?: string;
}

/** Formata mensagem amigável para envio de cobrança no WhatsApp */
export function formatarMensagemCobranca({
  nome,
  valor,
  dividas = [],
  chavePix,
}: MensagemCobrancaParams): string {
  const chave = chavePix || obterChavePix();
  const payload = gerarPayloadPix({ chave, valor });

  let msg = `Fala, *${nome}*! ⚽👋\n`;
  msg += `Passando para enviar os dados do acerto do racha:\n\n`;
  msg += `💰 *Total a pagar:* ${formatarReais(valor)}\n`;

  if (dividas.length > 0) {
    msg += `\n📋 *Detalhamento das dívidas:*\n`;
    dividas.forEach((d) => {
      const tipo = d.tipo.charAt(0).toUpperCase() + d.tipo.slice(1);
      const ref = d.referencia ? ` (ref. ${d.referencia})` : "";
      const desc = d.descricao ? ` - ${d.descricao}` : "";
      msg += `• ${tipo}${ref}: ${formatarReais(Number(d.valor))}${desc}\n`;
    });
  }

  msg += `\n🔑 *Chave Pix:* \`${chave}\`\n\n`;
  msg += `📱 *Pix Copia e Cola (basta copiar e colar no app do banco):*\n`;
  msg += `${payload}\n\n`;
  msg += `Após realizar o pagamento, por favor mande o comprovante por aqui. Valeu! 👊`;

  return msg;
}

export function gerarLinkWhatsApp(params: MensagemCobrancaParams & { telefone?: string }): string {
  const msg = formatarMensagemCobranca(params);
  const telLimpo = params.telefone ? params.telefone.replace(/\D/g, "") : "";
  const baseUrl = telLimpo ? `https://wa.me/${telLimpo}` : `https://wa.me/`;
  return `${baseUrl}?text=${encodeURIComponent(msg)}`;
}

interface PixCopiaEColaProps {
  valor?: number;
  chavePix?: string;
  nomeDevedor?: string;
  descricao?: string;
  permitirEditarChave?: boolean;
  onChaveAtualizada?: (novaChave: string) => void;
  compacto?: boolean;
}

export function PixCopiaECola({
  valor,
  chavePix: chaveProp,
  nomeDevedor,
  descricao,
  permitirEditarChave = false,
  onChaveAtualizada,
  compacto = false,
}: PixCopiaEColaProps) {
  const [chave, setChave] = useState(() => chaveProp || obterChavePix());
  const [editandoChave, setEditandoChave] = useState(false);
  const [chaveTemp, setChaveTemp] = useState(chave);
  const [copiadoPayload, setCopiadoPayload] = useState(false);
  const [copiadaChave, setCopiadaChave] = useState(false);

  const payload = gerarPayloadPix({ chave, valor });

  async function copiarTexto(texto: string, tipo: "payload" | "chave") {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      if (tipo === "payload") {
        setCopiadoPayload(true);
        setTimeout(() => setCopiadoPayload(false), 2500);
      } else {
        setCopiadaChave(true);
        setTimeout(() => setCopiadaChave(false), 2500);
      }
    } catch (e) {
      console.error("Erro ao copiar texto:", e);
    }
  }

  function handleSalvarChave() {
    if (!chaveTemp.trim()) return;
    salvarChavePix(chaveTemp);
    setChave(chaveTemp.trim());
    setEditandoChave(false);
    onChaveAtualizada?.(chaveTemp.trim());
  }

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <QrCode className="size-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              Pagamento via Pix
              {valor != null && valor > 0 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                  ({formatarReais(valor)})
                </span>
              )}
            </h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {descricao || (nomeDevedor ? `Acerto de ${nomeDevedor}` : "Copia e cola ou chave direta")}
            </p>
          </div>
        </div>

        {permitirEditarChave && !editandoChave && (
          <button
            type="button"
            onClick={() => {
              setChaveTemp(chave);
              setEditandoChave(true);
            }}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Alterar Chave Pix"
          >
            <Settings className="size-4" />
          </button>
        )}
      </div>

      {/* Editor de Chave (para admins) */}
      {editandoChave && (
        <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Configurar Chave Pix do Administrador:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={chaveTemp}
              onChange={(e) => setChaveTemp(e.target.value)}
              placeholder="ex: email, celular, CPF ou chave aleatória"
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={handleSalvarChave}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditandoChave(false)}
              className="px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Seção Chave Pix */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="min-w-0 flex items-center gap-2">
          <KeyRound className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-semibold text-neutral-400">
              Chave Pix:
            </span>
            <span className="block truncate text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100">
              {chave}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => copiarTexto(chave, "chave")}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition shrink-0 active:scale-95"
        >
          {copiadaChave ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Chave copiada!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copiar chave</span>
            </>
          )}
        </button>
      </div>

      {/* Seção Pix Copia e Cola (Payload BR Code) */}
      {!compacto && (
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Código Pix Copia e Cola {valor ? `(com valor de ${formatarReais(valor)})` : ""}:
          </label>
          <div className="relative">
            <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 break-all max-h-20 overflow-y-auto select-all">
              {payload}
            </div>
          </div>
          <button
            type="button"
            onClick={() => copiarTexto(payload, "payload")}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition active:scale-[0.98]"
          >
            {copiadoPayload ? (
              <>
                <Check className="size-4" />
                <span>Código Pix Copiado com Sucesso! 🎉</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>Copiar Código Pix Copia e Cola</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

interface BotaoCobrarWhatsAppProps {
  nome: string;
  valor: number;
  dividas?: Divida[];
  chavePix?: string;
  telefone?: string;
  className?: string;
}

export function BotaoCobrarWhatsApp({
  nome,
  valor,
  dividas,
  chavePix,
  telefone,
  className = "",
}: BotaoCobrarWhatsAppProps) {
  const link = gerarLinkWhatsApp({
    nome,
    valor,
    dividas,
    chavePix,
    telefone,
  });

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition active:scale-95 ${className}`}
      title={`Cobrar ${nome} no WhatsApp`}
    >
      <MessageCircle className="size-3.5" />
      <span>Cobrar WhatsApp</span>
    </a>
  );
}
