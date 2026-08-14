import { useEffect, useRef, useState, useCallback } from "react";
import {
  Share2,
  Download,
  Copy,
  X,
  Sparkles,
  Smartphone,
  Square,
  Check,
} from "lucide-react";
import {
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
  STATUS_LABEL,
} from "../lib/partidas";
import { formatarDataCompleta } from "../lib/formatacao";
import { vibrateLight, vibrateSuccess } from "../lib/haptics";

export type FormatoCard = "stories" | "feed"; // stories = 9:16 (1080x1920), feed = 1:1 (1080x1080)

export interface GeradorCardCompartilhamentoProps {
  open: boolean;
  onClose: () => void;
  partida: Partida;
  placar: Placar | null;
  participantes: Participante[];
  craque?: NotaPartida | null;
  notas?: NotaPartida[];
}

function desenharRetanguloArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function GeradorCardCompartilhamento({
  open,
  onClose,
  partida,
  placar,
  participantes,
  craque,
}: GeradorCardCompartilhamentoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formato, setFormato] = useState<FormatoCard>("stories");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  const participantesPreto = participantes.filter((p) => p.time === "a");
  const participantesBranco = participantes.filter((p) => p.time === "b");

  const artilheirosPreto = participantesPreto.filter((p) => p.gols > 0);
  const artilheirosBranco = participantesBranco.filter((p) => p.gols > 0);

  const golsPreto = placar ? placar.gols_time_a : 0;
  const golsBranco = placar ? placar.gols_time_b : 0;

  const craqueParticipante = craque
    ? participantes.find((p) => p.jogador_id === craque.target_id)
    : null;

  const desenharCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setGerando(true);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
    } catch {
      // continua mesmo se fonts.ready falhar
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isStories = formato === "stories";
    const width = 1080;
    const height = isStories ? 1920 : 1080;

    canvas.width = width;
    canvas.height = height;

    // 1. FUNDO STADIUM NOIR (Gradiente profundo + Holofotes de Estádio)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#080c14");
    bgGrad.addColorStop(0.5, "#0b0f19");
    bgGrad.addColorStop(1, "#030407");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Holofote Superior Âmbar/Dourado
    const spotGold = ctx.createRadialGradient(
      width / 2,
      isStories ? 240 : 180,
      10,
      width / 2,
      isStories ? 240 : 180,
      520,
    );
    spotGold.addColorStop(0, "rgba(245, 158, 11, 0.22)");
    spotGold.addColorStop(0.5, "rgba(245, 158, 11, 0.06)");
    spotGold.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = spotGold;
    ctx.fillRect(0, 0, width, height);

    // Holofote Inferior Esmeralda/Gramado
    const spotGreen = ctx.createRadialGradient(
      width / 2,
      height - 100,
      20,
      width / 2,
      height - 100,
      600,
    );
    spotGreen.addColorStop(0, "rgba(16, 185, 129, 0.16)");
    spotGreen.addColorStop(0.6, "rgba(16, 185, 129, 0.03)");
    spotGreen.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = spotGreen;
    ctx.fillRect(0, 0, width, height);

    // 2. LINHAS GEOMÉTRICAS DO CAMPO DE FUTEBOL (Textura Vetorial Sutil)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 3;

    // Borda externa do campo
    desenharRetanguloArredondado(ctx, 40, 40, width - 80, height - 80, 24);
    ctx.stroke();

    // Moldura interna com cantos dourados
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 2;
    const cornerSize = 40;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(50, 50 + cornerSize);
    ctx.lineTo(50, 50);
    ctx.lineTo(50 + cornerSize, 50);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - 50 - cornerSize, 50);
    ctx.lineTo(width - 50, 50);
    ctx.lineTo(width - 50, 50 + cornerSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(50, height - 50 - cornerSize);
    ctx.lineTo(50, height - 50);
    ctx.lineTo(50 + cornerSize, height - 50);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - 50 - cornerSize, height - 50);
    ctx.lineTo(width - 50, height - 50);
    ctx.lineTo(width - 50, height - 50 - cornerSize);
    ctx.stroke();

    // Círculo central do campo estilizado
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, isStories ? 260 : 200, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. CABEÇALHO DO CARD (Escudo + Racha Gragoatá + Data + Partida)
    const headerY = isStories ? 130 : 90;

    // Escudo Central Vetorial
    ctx.save();
    ctx.translate(width / 2 - 32, headerY);
    // Escudo Verde
    ctx.fillStyle = "#15803d";
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(8, 9);
    ctx.lineTo(8, 28);
    ctx.bezierCurveTo(8, 44, 20, 56, 32, 60);
    ctx.bezierCurveTo(44, 56, 56, 44, 56, 28);
    ctx.lineTo(56, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bola central amarela
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(32, 30, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Título Principal "RACHA GRAGOATÁ"
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 46px "Space Grotesk", "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = "2px";
    ctx.fillText("RACHA GRAGOATÁ", width / 2, headerY + 105);

    // Subtítulo / Badge de Partida
    ctx.fillStyle = "#f59e0b";
    ctx.font = '800 22px "Space Grotesk", sans-serif';
    ctx.letterSpacing = "3px";
    ctx.fillText(
      `SÚMULA OFICIAL · PARTIDA #${partida.id}`,
      width / 2,
      headerY + 142,
    );

    // Data Formatada
    ctx.fillStyle = "#94a3b8";
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = "1px";
    const dataStr = formatarDataCompleta(partida.data_jogo).toUpperCase();
    ctx.fillText(dataStr, width / 2, headerY + 175);

    // 4. PLACAR DE ESTÁDIO (Time Preto × Time Branco)
    const placarBoxY = isStories ? headerY + 225 : headerY + 195;
    const placarBoxHeight = isStories ? 320 : 250;
    const placarBoxWidth = width - 140;
    const placarBoxX = 70;

    // Card Container do Placar
    ctx.save();
    desenharRetanguloArredondado(
      ctx,
      placarBoxX,
      placarBoxY,
      placarBoxWidth,
      placarBoxHeight,
      24,
    );
    const placarBg = ctx.createLinearGradient(
      0,
      placarBoxY,
      0,
      placarBoxY + placarBoxHeight,
    );
    placarBg.addColorStop(0, "rgba(24, 24, 27, 0.9)");
    placarBg.addColorStop(1, "rgba(9, 9, 11, 0.95)");
    ctx.fillStyle = placarBg;
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Time Preto (Lado Esquerdo)
    const colLeftX = placarBoxX + placarBoxWidth * 0.25;
    // Badge Time Preto
    ctx.save();
    desenharRetanguloArredondado(ctx, colLeftX - 110, placarBoxY + 30, 220, 44, 12);
    ctx.fillStyle = "#18181b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#f4f4f5";
    ctx.font = '800 18px "Space Grotesk", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("TIME PRETO", colLeftX, placarBoxY + 58);
    ctx.restore();

    // Gol Time Preto (GIGANTE)
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 130px "Bebas Neue", "Impact", sans-serif';
    ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
    ctx.shadowBlur = 18;
    ctx.fillText(String(golsPreto), colLeftX, placarBoxY + (isStories ? 215 : 180));
    ctx.shadowBlur = 0;

    // Divisor Central "VS"
    ctx.fillStyle = "#f59e0b";
    ctx.font = '900 42px "Bebas Neue", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("X", width / 2, placarBoxY + (isStories ? 180 : 155));

    // Status da partida abaixo do X
    ctx.font = '800 14px "Space Grotesk", sans-serif';
    ctx.fillStyle =
      partida.status === "closed"
        ? "#10b981"
        : partida.status === "live"
          ? "#ef4444"
          : "#f59e0b";
    ctx.fillText(
      STATUS_LABEL[partida.status].toUpperCase(),
      width / 2,
      placarBoxY + (isStories ? 220 : 190),
    );

    // Time Branco (Lado Direito)
    const colRightX = placarBoxX + placarBoxWidth * 0.75;
    // Badge Time Branco
    ctx.save();
    desenharRetanguloArredondado(ctx, colRightX - 110, placarBoxY + 30, 220, 44, 12);
    ctx.fillStyle = "#f4f4f5";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#09090b";
    ctx.font = '800 18px "Space Grotesk", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("TIME BRANCO", colRightX, placarBoxY + 58);
    ctx.restore();

    // Gol Time Branco (GIGANTE)
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 130px "Bebas Neue", "Impact", sans-serif';
    ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
    ctx.shadowBlur = 18;
    ctx.fillText(String(golsBranco), colRightX, placarBoxY + (isStories ? 215 : 180));
    ctx.shadowBlur = 0;

    if (isStories) {
      // STORIES (9:16) LAYOUT DETALHADO

      // 5. CARD DO CRAQUE DA PARTIDA (MVP)
      let currentY = placarBoxY + placarBoxHeight + 35;

      if (craque) {
        const craqueBoxHeight = 300;
        const craqueBoxWidth = width - 140;
        const craqueBoxX = 70;

        ctx.save();
        // Moldura Dourada com Gradiente
        desenharRetanguloArredondado(
          ctx,
          craqueBoxX,
          currentY,
          craqueBoxWidth,
          craqueBoxHeight,
          20,
        );
        const craqueGrad = ctx.createLinearGradient(
          craqueBoxX,
          currentY,
          craqueBoxX + craqueBoxWidth,
          currentY + craqueBoxHeight,
        );
        craqueGrad.addColorStop(0, "rgba(30, 27, 22, 0.95)");
        craqueGrad.addColorStop(0.5, "rgba(20, 18, 14, 0.98)");
        craqueGrad.addColorStop(1, "rgba(12, 10, 8, 1)");
        ctx.fillStyle = craqueGrad;
        ctx.fill();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.restore();

        // Faixa Superior do Craque
        ctx.save();
        desenharRetanguloArredondado(
          ctx,
          craqueBoxX + 20,
          currentY + 20,
          craqueBoxWidth - 40,
          36,
          8,
        );
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#fde68a";
        ctx.font = '800 16px "Space Grotesk", sans-serif';
        ctx.letterSpacing = "2px";
        ctx.fillText(
          "⭐ CRAQUE DA PARTIDA · MELHOR EM CAMPO ⭐",
          width / 2,
          currentY + 44,
        );
        ctx.restore();

        // Nome do Craque
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 46px "Space Grotesk", sans-serif';
        ctx.fillText(craque.nome.toUpperCase(), width / 2, currentY + 120);

        // Micro-stats do Craque
        const golsCraque = craqueParticipante?.gols ?? 0;
        const assistCraque = craqueParticipante?.assistencias ?? 0;

        // Container de Nota e Estatísticas
        const statsBoxY = currentY + 150;
        ctx.fillStyle = "#fbbf24";
        ctx.font = '900 68px "Bebas Neue", sans-serif';
        ctx.fillText(
          `${Number(craque.avg_rating).toFixed(1)}`,
          width / 2 - 80,
          statsBoxY + 58,
        );

        ctx.font = '700 24px "Space Grotesk", sans-serif';
        ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
        ctx.fillText("/ 10", width / 2 - 20, statsBoxY + 54);

        // Votos e Gols
        ctx.textAlign = "left";
        ctx.fillStyle = "#cbd5e1";
        ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `⚽ ${golsCraque} ${golsCraque === 1 ? "Gol" : "Gols"}   🅰️ ${assistCraque} Assists`,
          width / 2 + 25,
          statsBoxY + 30,
        );
        ctx.fillStyle = "#94a3b8";
        ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `Eleito com ${craque.vote_count} votos`,
          width / 2 + 25,
          statsBoxY + 60,
        );

        currentY += craqueBoxHeight + 35;
      }

      // 6. ARTILHEIROS / SÚMULA DE GOLS
      const artilhariaBoxHeight = 360;
      const artilhariaBoxWidth = width - 140;
      const artilhariaBoxX = 70;

      ctx.save();
      desenharRetanguloArredondado(
        ctx,
        artilhariaBoxX,
        currentY,
        artilhariaBoxWidth,
        artilhariaBoxHeight,
        20,
      );
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Título Artilharia
      ctx.textAlign = "center";
      ctx.fillStyle = "#f59e0b";
      ctx.font = '800 20px "Space Grotesk", sans-serif';
      ctx.letterSpacing = "2px";
      ctx.fillText(
        "📊 REGISTRO DE GOLS & DESTAQUES",
        width / 2,
        currentY + 45,
      );

      // Divisor vertical
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width / 2, currentY + 70);
      ctx.lineTo(width / 2, currentY + artilhariaBoxHeight - 20);
      ctx.stroke();

      // Gols Time Preto (Esquerda)
      const leftStartX = artilhariaBoxX + 30;
      ctx.textAlign = "left";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = '700 18px "Space Grotesk", sans-serif';
      ctx.fillText("TIME PRETO", leftStartX, currentY + 90);

      let py = currentY + 130;
      if (artilheirosPreto.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = 'italic 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText("Nenhum gol", leftStartX, py);
      } else {
        artilheirosPreto.forEach((p) => {
          ctx.fillStyle = "#ffffff";
          ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`⚽ ${p.nome}`, leftStartX, py);
          if (p.gols > 1) {
            ctx.fillStyle = "#f59e0b";
            ctx.font = '800 15px "Space Grotesk", sans-serif';
            ctx.fillText(` (${p.gols}x)`, leftStartX + 180, py);
          }
          py += 36;
        });
      }

      // Gols Time Branco (Direita)
      const rightStartX = width / 2 + 30;
      ctx.textAlign = "left";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = '700 18px "Space Grotesk", sans-serif';
      ctx.fillText("TIME BRANCO", rightStartX, currentY + 90);

      let by = currentY + 130;
      if (artilheirosBranco.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = 'italic 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText("Nenhum gol", rightStartX, by);
      } else {
        artilheirosBranco.forEach((p) => {
          ctx.fillStyle = "#ffffff";
          ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`⚽ ${p.nome}`, rightStartX, by);
          if (p.gols > 1) {
            ctx.fillStyle = "#f59e0b";
            ctx.font = '800 15px "Space Grotesk", sans-serif';
            ctx.fillText(` (${p.gols}x)`, rightStartX + 180, by);
          }
          by += 36;
        });
      }

      // 7. RODAPÉ DE VIRALIZAÇÃO & RESENHA
      const footerY = height - 120;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f59e0b";
      ctx.font = '800 20px "Space Grotesk", sans-serif';
      ctx.letterSpacing = "2px";
      ctx.fillText(
        "🔥 CLÁSSICO DE RESENHA NO GRAGOATÁ 🔥",
        width / 2,
        footerY,
      );

      ctx.fillStyle = "#94a3b8";
      ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
      ctx.letterSpacing = "1px";
      ctx.fillText(
        "Acompanhe súmulas, notas e rankings pelo aplicativo oficial",
        width / 2,
        footerY + 34,
      );
    } else {
      // FEED / QUADRADO (1:1) LAYOUT COMPACTO E IMPACTANTE

      const currentY = placarBoxY + placarBoxHeight + 35;
      const bottomBoxHeight = 310;
      const bottomBoxWidth = width - 140;
      const bottomBoxX = 70;

      ctx.save();
      desenharRetanguloArredondado(
        ctx,
        bottomBoxX,
        currentY,
        bottomBoxWidth,
        bottomBoxHeight,
        20,
      );
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fill();
      ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      if (craque) {
        // Craque + Resumo Lado a Lado
        ctx.textAlign = "left";
        ctx.fillStyle = "#fde68a";
        ctx.font = '800 16px "Space Grotesk", sans-serif';
        ctx.letterSpacing = "2px";
        ctx.fillText(
          "⭐ CRAQUE DA PARTIDA (MVP)",
          bottomBoxX + 30,
          currentY + 45,
        );

        ctx.fillStyle = "#ffffff";
        ctx.font = '900 36px "Space Grotesk", sans-serif';
        ctx.fillText(craque.nome.toUpperCase(), bottomBoxX + 30, currentY + 95);

        ctx.fillStyle = "#fbbf24";
        ctx.font = '900 52px "Bebas Neue", sans-serif';
        ctx.fillText(
          `NOTA ${Number(craque.avg_rating).toFixed(1)} / 10`,
          bottomBoxX + 30,
          currentY + 160,
        );

        // Divisor vertical
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.moveTo(width / 2 + 30, currentY + 30);
        ctx.lineTo(width / 2 + 30, currentY + bottomBoxHeight - 30);
        ctx.stroke();

        // Gols do jogo resumidos na direita
        const rightX = width / 2 + 60;
        ctx.fillStyle = "#cbd5e1";
        ctx.font = '800 18px "Space Grotesk", sans-serif';
        ctx.fillText("⚽ GOLS DA PARTIDA", rightX, currentY + 45);

        let py = currentY + 85;
        const todosArtilheiros = [
          ...artilheirosPreto.map((a) => ({ ...a, timeNome: "Preto" })),
          ...artilheirosBranco.map((a) => ({ ...a, timeNome: "Branco" })),
        ].slice(0, 5);

        if (todosArtilheiros.length === 0) {
          ctx.fillStyle = "#64748b";
          ctx.font = 'italic 16px "Plus Jakarta Sans", sans-serif';
          ctx.fillText("Empate sem gols (0 × 0)", rightX, py);
        } else {
          todosArtilheiros.forEach((a) => {
            ctx.fillStyle = "#ffffff";
            ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(
              `• ${a.nome} (${a.timeNome})${a.gols > 1 ? ` - ${a.gols}x` : ""}`,
              rightX,
              py,
            );
            py += 30;
          });
        }
      } else {
        // Sem Craque (apenas artilharia)
        ctx.textAlign = "center";
        ctx.fillStyle = "#f59e0b";
        ctx.font = '800 22px "Space Grotesk", sans-serif';
        ctx.fillText(
          "⚽ DESTAQUES & ARTILHARIA DO CLÁSSICO",
          width / 2,
          currentY + 50,
        );

        const leftX = bottomBoxX + 40;
        const rightX = width / 2 + 40;

        ctx.textAlign = "left";
        ctx.fillStyle = "#e2e8f0";
        ctx.font = '700 18px "Space Grotesk", sans-serif';
        ctx.fillText("TIME PRETO:", leftX, currentY + 100);
        ctx.fillText("TIME BRANCO:", rightX, currentY + 100);

        let ly = currentY + 140;
        artilheirosPreto.forEach((p) => {
          ctx.fillStyle = "#ffffff";
          ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`⚽ ${p.nome} (${p.gols}x)`, leftX, ly);
          ly += 34;
        });

        let ry = currentY + 140;
        artilheirosBranco.forEach((p) => {
          ctx.fillStyle = "#ffffff";
          ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`⚽ ${p.nome} (${p.gols}x)`, rightX, ry);
          ry += 34;
        });
      }

      // Rodapé Feed
      const footerY = height - 60;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f59e0b";
      ctx.font = '800 18px "Space Grotesk", sans-serif';
      ctx.letterSpacing = "2px";
      ctx.fillText(
        "🔥 RACHA GRAGOATÁ · CLÁSSICO DE RESENHA 🔥",
        width / 2,
        footerY,
      );
    }

    setGerando(false);
  }, [
    formato,
    partida,
    placar,
    golsPreto,
    golsBranco,
    craque,
    craqueParticipante,
    artilheirosPreto,
    artilheirosBranco,
  ]);

  useEffect(() => {
    if (open) {
      desenharCanvas();
    }
  }, [open, formato, desenharCanvas]);

  async function obterBlobPng(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
    });
  }

  async function handleCompartilhar() {
    vibrateLight();
    setMensagemStatus(null);

    const blob = await obterBlobPng();
    if (!blob) return;

    const fileName = `racha-gragoata-partida-${partida.id}-${formato}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    // Testa suporte do navigator.share com arquivos
    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Partida #${partida.id} - Racha Gragoatá`,
          text: `Confira o resultado da Partida #${partida.id} do Racha Gragoatá! ⚽🔥`,
        });
        vibrateSuccess();
        setMensagemStatus("Card compartilhado com sucesso!");
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // Usuário cancelou a janela de compartilhamento
        }
      }
    }

    // Fallback: Baixar imagem automaticamente
    handleBaixar();
  }

  async function handleBaixar() {
    vibrateLight();
    const blob = await obterBlobPng();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `racha-partida-${partida.id}-${formato}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    vibrateSuccess();
    setMensagemStatus("Download da imagem em alta definição concluído! 📥");
  }

  async function handleCopiarImagem() {
    vibrateLight();
    try {
      const blob = await obterBlobPng();
      if (!blob) return;

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        vibrateSuccess();
        setCopiado(true);
        setMensagemStatus("Imagem copiada para a área de transferência! 📋");
        setTimeout(() => setCopiado(false), 3000);
      } else {
        handleBaixar();
      }
    } catch {
      handleBaixar();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col max-h-[92vh] w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-400" />
            <h3 className="font-heading text-sm font-bold tracking-wide text-white">
              Card Oficial de Compartilhamento
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Seletor de Formato */}
        <div className="flex items-center justify-center gap-2 p-2.5 bg-neutral-900/40 border-b border-neutral-800/80">
          <button
            type="button"
            onClick={() => {
              vibrateLight();
              setFormato("stories");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              formato === "stories"
                ? "bg-amber-500 text-neutral-950 shadow-md"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Smartphone className="size-3.5" />
            <span>Stories (9:16)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrateLight();
              setFormato("feed");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              formato === "feed"
                ? "bg-amber-500 text-neutral-950 shadow-md"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Square className="size-3.5" />
            <span>Feed / Zap (1:1)</span>
          </button>
        </div>

        {/* Área de Visualização do Canvas */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-neutral-950/80">
          <div className="relative rounded-xl border border-amber-500/20 shadow-2xl overflow-hidden max-h-[50vh] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className={`max-h-[48vh] w-auto object-contain rounded-lg transition-all ${
                gerando ? "opacity-40 scale-98" : "opacity-100 scale-100"
              }`}
            />
            {gerando && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                <span className="text-xs font-bold text-amber-400 animate-pulse">
                  Renderizando em Alta Definição…
                </span>
              </div>
            )}
          </div>

          {mensagemStatus && (
            <p className="mt-3 text-center text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-3 py-1.5">
              {mensagemStatus}
            </p>
          )}
        </div>

        {/* Ações / Botões de Exportação */}
        <div className="border-t border-neutral-800 bg-neutral-900/90 p-3.5 space-y-2">
          <button
            type="button"
            onClick={handleCompartilhar}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 px-4 py-3 text-sm font-bold text-neutral-950 shadow-lg active:scale-98 transition cursor-pointer"
          >
            <Share2 className="size-4" />
            <span>Compartilhar nos Stories / WhatsApp</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleBaixar}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700/80 px-3 py-2.5 text-xs font-semibold text-neutral-200 active:scale-98 transition cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Baixar Imagem PNG</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarImagem}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700/80 px-3 py-2.5 text-xs font-semibold text-neutral-200 active:scale-98 transition cursor-pointer"
            >
              {copiado ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copiar Imagem</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
