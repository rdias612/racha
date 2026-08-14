/**
 * Motor de Confetes e Celebrações em Canvas 2D Puro
 * - Zero dependências externas
 * - 60 FPS com interpolação física realista (gravidade, arrasto e rotação 3D)
 * - Suporte nativo a prefers-reduced-motion e telas Retina/Hi-DPI
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'star' | 'ribbon';
  angle: number;
  angularVelocity: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
}

class ConfettiEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private isRunning = false;
  private dpr = 1;

  private initCanvas(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    // Respeita preferência do usuário por movimento reduzido
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'racha-confetti-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '99999';
      document.body.appendChild(this.canvas);
      window.addEventListener('resize', this.handleResize);
    }

    this.ctx = this.canvas.getContext('2d');
    this.updateSize();
    return !!this.ctx;
  }

  private handleResize = () => {
    if (this.canvas) {
      this.updateSize();
    }
  };

  private updateSize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  public launch(options: {
    originX?: number; // 0 to 1
    originY?: number; // 0 to 1
    particleCount?: number;
    spread?: number; // degrees
    angle?: number; // degrees (90 = up)
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    colors?: string[];
    shapes?: ('rect' | 'circle' | 'star' | 'ribbon')[];
    ticks?: number;
    scalar?: number;
  }) {
    if (!this.initCanvas() || !this.ctx) return;

    const {
      originX = 0.5,
      originY = 0.6,
      particleCount = 70,
      spread = 70,
      angle = 90,
      startVelocity = 45,
      decay = 0.92,
      gravity = 0.35,
      colors = ['#10B981', '#F59E0B', '#FBBF24', '#FFFFFF', '#22C55E', '#16A34A'],
      shapes = ['rect', 'circle'],
      ticks = 220,
      scalar = 1,
    } = options;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const startX = originX * width;
    const startY = originY * height;

    const radAngle = (angle * Math.PI) / 180;
    const radSpread = (spread * Math.PI) / 180;

    for (let i = 0; i < particleCount; i++) {
      const pAngle = radAngle + (Math.random() - 0.5) * radSpread;
      const speed = (startVelocity * (0.6 + Math.random() * 0.8)) * (0.8 + Math.random() * 0.4);
      const chosenShape = shapes[Math.floor(Math.random() * shapes.length)];
      const chosenColor = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(pAngle) * speed,
        vy: -Math.sin(pAngle) * speed,
        size: (6 + Math.random() * 6) * scalar,
        color: chosenColor,
        shape: chosenShape,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        opacity: 1,
        life: 0,
        maxLife: ticks * (0.7 + Math.random() * 0.5),
        gravity,
        drag: decay,
      });
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  }

  private animate = () => {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;

      // Atualiza física
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.angularVelocity;
      p.wobble += p.wobbleSpeed;

      // Fade out no final da vida
      const progress = p.life / p.maxLife;
      if (progress > 0.7) {
        p.opacity = Math.max(0, 1 - (progress - 0.7) / 0.3);
      }

      if (p.life >= p.maxLife || p.opacity <= 0 || p.y > window.innerHeight + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      // Renderiza com escala DPR
      this.ctx.save();
      this.ctx.scale(this.dpr, this.dpr);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.angle);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;

      const scaleX = Math.cos(p.wobble);

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, (-p.size / 2) * scaleX, p.size, p.size * scaleX);
      } else if (p.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.size / 2, (p.size / 2) * Math.abs(scaleX), 0, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.shape === 'star') {
        this.drawStar(this.ctx, 0, 0, 5, p.size, p.size / 2);
      } else if (p.shape === 'ribbon') {
        this.ctx.fillRect(-p.size * 0.3, (-p.size * 1.5) * scaleX, p.size * 0.6, p.size * 3 * scaleX);
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };
}

const engine = new ConfettiEngine();

/**
 * Explosão de celebração ao marcar um gol!
 * Dispara confetes com cores do racha, amarelo/ouro e verde vibrante.
 */
export function dispararConfetesGol() {
  // Canhão central explosivo
  engine.launch({
    originX: 0.5,
    originY: 0.75,
    particleCount: 90,
    spread: 85,
    angle: 90,
    startVelocity: 48,
    decay: 0.93,
    gravity: 0.4,
    colors: ['#10B981', '#059669', '#F59E0B', '#FBBF24', '#FFFFFF', '#34D399', '#F59E0B'],
    shapes: ['rect', 'circle', 'ribbon'],
    ticks: 240,
    scalar: 1.1,
  });

  // Micro-burst complementar
  setTimeout(() => {
    engine.launch({
      originX: 0.5,
      originY: 0.7,
      particleCount: 45,
      spread: 120,
      angle: 90,
      startVelocity: 36,
      colors: ['#FBBF24', '#F59E0B', '#FFFFFF'],
      shapes: ['star', 'rect'],
      ticks: 180,
      scalar: 0.9,
    });
  }, 120);
}

/**
 * Celebração dourada para o Craque da Partida (MVP / FUT Panini)
 * Dispara estrelas douradas, diamantes e confetes cintilantes.
 */
export function dispararConfetesCraque() {
  const tonsDourados = ['#FFD700', '#F59E0B', '#FEF08A', '#FDE047', '#FFFFFF', '#D97706', '#B45309'];

  engine.launch({
    originX: 0.5,
    originY: 0.65,
    particleCount: 110,
    spread: 100,
    angle: 90,
    startVelocity: 42,
    decay: 0.94,
    gravity: 0.32,
    colors: tonsDourados,
    shapes: ['star', 'circle', 'rect'],
    ticks: 280,
    scalar: 1.25,
  });

  // Segundo pulso de estrelas
  setTimeout(() => {
    engine.launch({
      originX: 0.45,
      originY: 0.6,
      particleCount: 50,
      spread: 60,
      angle: 75,
      startVelocity: 38,
      colors: tonsDourados,
      shapes: ['star'],
      ticks: 260,
      scalar: 1.1,
    });
    engine.launch({
      originX: 0.55,
      originY: 0.6,
      particleCount: 50,
      spread: 60,
      angle: 105,
      startVelocity: 38,
      colors: tonsDourados,
      shapes: ['star'],
      ticks: 260,
      scalar: 1.1,
    });
  }, 180);
}

/**
 * Canhões de estádio para o Time Vencedor ou Fim de Jogo triunfal!
 * Lançamento sincronizado dos cantos inferiores esquerdo e direito.
 */
export function dispararConfetesVitoria() {
  const coresCampeao = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#FBBF24', '#FFFFFF'];

  // Canhão Esquerdo
  engine.launch({
    originX: 0.1,
    originY: 0.85,
    particleCount: 75,
    spread: 55,
    angle: 55,
    startVelocity: 54,
    decay: 0.93,
    gravity: 0.38,
    colors: coresCampeao,
    shapes: ['rect', 'ribbon', 'circle'],
    ticks: 260,
    scalar: 1.1,
  });

  // Canhão Direito
  engine.launch({
    originX: 0.9,
    originY: 0.85,
    particleCount: 75,
    spread: 55,
    angle: 125,
    startVelocity: 54,
    decay: 0.93,
    gravity: 0.38,
    colors: coresCampeao,
    shapes: ['rect', 'ribbon', 'circle'],
    ticks: 260,
    scalar: 1.1,
  });

  // Cascata central 200ms depois
  setTimeout(() => {
    engine.launch({
      originX: 0.5,
      originY: 0.4,
      particleCount: 80,
      spread: 140,
      angle: 90,
      startVelocity: 32,
      decay: 0.91,
      gravity: 0.3,
      colors: ['#FBBF24', '#10B981', '#FFFFFF', '#F59E0B'],
      shapes: ['star', 'rect', 'circle'],
      ticks: 240,
      scalar: 1.0,
    });
  }, 220);
}
