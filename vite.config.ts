import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// public/sw.js é copiado como arquivo estático — não passa pelo pipeline de
// import.meta.env. Os placeholders de configuração do Web Push (URL, anon key
// e chave VAPID) são substituídos no build com as variáveis VITE_* do ambiente
// (.env local e Vercel). Variável ausente mantém o placeholder: o sw.js detecta
// e mantém o push em no-op.
function injetarConfigNoSw(env: Record<string, string>): Plugin {
  return {
    name: 'injetar-config-no-sw',
    apply: 'build',
    closeBundle() {
      const substituicoes: Array<[string, string]> = [
        ['__SUPABASE_URL__', env['VITE_SUPABASE_URL']],
        ['__SUPABASE_ANON_KEY__', env['VITE_SUPABASE_ANON_KEY']],
        ['__VAPID_PUBLIC_KEY__', env['VITE_VAPID_PUBLIC_KEY']],
      ];
      const caminho = resolve(process.cwd(), 'dist', 'sw.js');
      let conteudo = readFileSync(caminho, 'utf-8');
      for (const [placeholder, valor] of substituicoes) {
        conteudo = conteudo.replaceAll(placeholder, (valor ?? '').trim() || placeholder);
      }
      writeFileSync(caminho, conteudo);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss(), injetarConfigNoSw(env)],
  };
});
