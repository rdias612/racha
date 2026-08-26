import { useEffect, useState } from 'react';
import { vibrateLight } from './haptics';

export type Tema = 'light' | 'dark';

const STORAGE_KEY = 'racha_tema';

function lerTemaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo === 'light' || salvo === 'dark') return salvo;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export const COR_FUNDO_DARK = '#12100d';
export const COR_FUNDO_LIGHT = '#f3efe4';

export function aplicarTema(tema: Tema) {
  const root = document.documentElement;
  if (tema === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  try {
    localStorage.setItem(STORAGE_KEY, tema);
  } catch {
    /* ignore */
  }

  // Atualiza meta theme-color para navegadores mobile e PWA respeitando a escolha do usuário
  const corFundo = tema === 'dark' ? COR_FUNDO_DARK : COR_FUNDO_LIGHT;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length > 0) {
    metas.forEach((meta) => {
      meta.removeAttribute('media');
      meta.content = corFundo;
    });
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = corFundo;
    document.head.appendChild(meta);
  }
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTemaInicial);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  const alternar = () => {
    vibrateLight();
    setTema((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return { tema, alternar };
}
