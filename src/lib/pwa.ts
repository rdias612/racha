import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Detecta iOS/Safari (não suporta beforeinstallprompt; instalação é manual
// via "Adicionar à Tela de Início" no Safari).
function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Detecta se o app já está rodando em modo standalone (instalado).
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

// --- Store module-level: o listener é registrado uma única vez no boot,
// independentemente da rota atual. Assim o preventDefault() sempre suprime
// o mini-infobar automático do Chrome, e o prompt fica disponível para o
// botão customizado em qualquer tela.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let instalado = isStandalone();
const ios = isIOS();
const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((o) => o());
}

function inscrever(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

/**
 * Deve ser chamado uma vez no boot do app (main.tsx). Registra os listeners
 * globais de `beforeinstallprompt` e `appinstalled`.
 */
export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // impede o banner/mini-infobar automático do Chrome
    deferredPrompt = e as BeforeInstallPromptEvent;
    instalado = false;
    notificar();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    instalado = true;
    notificar();
  });
}

/** Dispara o prompt de instalação nativo (Android/Chrome). */
export async function instalar() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  notificar();
}

/**
 * Hook reativo ao estado de instalação do PWA.
 * - Android/Chrome: `podeInstalar` true quando há prompt capturado.
 * - iOS: `iosManual` true para a UI mostrar instruções manuais.
 * - Se já estiver instalado, não oferece instalação.
 */
export function useInstalacaoPWA() {
  const [, setTick] = useState(0);
  useEffect(() => inscrever(() => setTick((t) => t + 1)), []);

  const podeInstalar = !instalado && (!!deferredPrompt || ios);
  return { podeInstalar, instalar, iosManual: ios && !instalado };
}

export type StatusPush = 'indisponivel' | 'desativado' | 'ativado' | 'negado';

function pushDisponivel() {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function chaveVapid() {
  const chave = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim().replace(/^['"]|['"]$/g, '');
  if (!chave) throw new Error('Chave pública VAPID não configurada.');
  if (!/^[A-Za-z0-9_-]+$/.test(chave)) {
    throw new Error(
      'Chave pública VAPID inválida: use somente a chave Base64URL, sem o nome da variável.'
    );
  }

  try {
    const padding = '='.repeat((4 - (chave.length % 4)) % 4);
    const base64 = (chave + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes.length !== 65 || bytes[0] !== 4) {
      throw new Error('tamanho ou formato do ponto P-256 inválido');
    }
    return bytes;
  } catch {
    throw new Error(
      'Chave pública VAPID inválida. Gere uma chave pública Web Push nova e atualize a Vercel.'
    );
  }
}

async function subscriptionAtual() {
  if (!pushDisponivel()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function dadosSubscription(subscription: PushSubscription) {
  const keys = subscription.toJSON().keys;
  const p256dh = keys?.['p256dh'];
  const auth = keys?.['auth'];
  if (!p256dh || !auth) {
    throw new Error('Subscription Web Push inválida.');
  }
  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  };
}

export async function statusPush(jogadorId: number): Promise<StatusPush> {
  if (!pushDisponivel()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'negado';
  const subscription = await subscriptionAtual();
  if (!subscription) return 'desativado';

  const { error } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('jogador_id', jogadorId)
    .eq('endpoint', subscription.endpoint)
    .maybeSingle();
  return error ? 'desativado' : 'ativado';
}

export async function ativarPush(jogadorId: number) {
  if (!pushDisponivel()) throw new Error('Web Push não é compatível neste dispositivo.');
  if (Notification.permission === 'denied') {
    throw new Error('As notificações estão bloqueadas neste navegador.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão para notificações não concedida.');

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveVapid(),
    }));
  const dados = dadosSubscription(subscription);
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ jogador_id: jogadorId, ...dados }, { onConflict: 'endpoint' });
  if (error) throw new Error('Não foi possível salvar a ativação das notificações.');
}

export async function desativarPush(jogadorId: number) {
  const subscription = await subscriptionAtual();
  if (!subscription) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('jogador_id', jogadorId)
    .eq('endpoint', subscription.endpoint);
  if (error) throw new Error('Não foi possível desativar as notificações.');
  await subscription.unsubscribe();
}
