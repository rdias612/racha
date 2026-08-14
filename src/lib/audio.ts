/**
 * Sintetizador de áudio Web Audio API para o Racha
 * Gera efeitos sonoros realistas sem necessidade de arquivos externos (100% offline).
 */

export type TipoApito = "inicio" | "fim" | "curto" | "duplo";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn("Web Audio Context não suportado ou bloqueado:", e);
    return null;
  }
}

/**
 * Sintetiza o som de um apito de juiz de futebol profissional
 * utilizando 2 osciladores senoidais com frequências próximas (efeito de batimento)
 * modulados por um LFO de ~30Hz (a esfera/pea de cortiça girando dentro do apito).
 */
export function tocarApito(tipo: TipoApito = "inicio"): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const agora = ctx.currentTime;

  function tocarSopro(
    inicio: number,
    duracao: number,
    freqPrincipal = 2700,
    freqSecundaria = 2950,
  ) {
    if (!ctx) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterGain = ctx.createGain();

    // Modulação (trill do apito - efeito da bolinha girando)
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(34, inicio);
    lfoGain.gain.setValueAtTime(180, inicio);

    lfo.connect(osc1.frequency);
    lfo.connect(osc2.frequency);

    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freqPrincipal, inicio);
    osc2.frequency.setValueAtTime(freqSecundaria, inicio);

    // Envelope de volume (Ataque rápido, sustain estável, fade suave)
    masterGain.gain.setValueAtTime(0.001, inicio);
    masterGain.gain.exponentialRampToValueAtTime(0.35, inicio + 0.04);
    masterGain.gain.setValueAtTime(0.35, inicio + duracao - 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    masterGain.connect(ctx.destination);

    lfo.start(inicio);
    osc1.start(inicio);
    osc2.start(inicio);

    lfo.stop(inicio + duracao + 0.02);
    osc1.stop(inicio + duracao + 0.02);
    osc2.stop(inicio + duracao + 0.02);
  }

  if (tipo === "inicio") {
    // 1 apito longo e forte: "Piiiiiii!"
    tocarSopro(agora, 0.95);
  } else if (tipo === "fim") {
    // 3 apitos tradicionais de fim de jogo: "Pi! Pi! Piiiiiiiii!"
    tocarSopro(agora, 0.22);
    tocarSopro(agora + 0.3, 0.22);
    tocarSopro(agora + 0.65, 0.95);
  } else if (tipo === "duplo") {
    // 2 apitos (falta/parada): "Pi! Piii!"
    tocarSopro(agora, 0.22);
    tocarSopro(agora + 0.3, 0.45);
  } else {
    // Apito curto: "Pi!"
    tocarSopro(agora, 0.3);
  }
}
