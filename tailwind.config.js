/**
 * Tailwind config + NativeWind v4 preset.
 * Task: T1.5 - Design system FutAmigos.
 *
 * Tokens PT-BR friendly:
 *   - field:    verde campo (primaria)
 *   - pitch:    tons de cinza neutros (50..900)
 *   - goalkeeper: laranja destaque (goleiros)
 *   - warning/success/danger: semantica
 *
 * darkMode 'class' prepara troca futura (nao habilitada no MVP UI).
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Verde campo - cor primaria do app (PRD: pelada campo)
        field: {
          DEFAULT: '#16a34a',
          dark: '#15803d',
          light: '#86efac',
        },
        // Tons de cinza neutros (chao do campo / UI bases)
        pitch: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        goalkeeper: {
          DEFAULT: '#ea580c',
        },
        warning: {
          DEFAULT: '#eab308',
        },
        success: {
          DEFAULT: '#22c55e',
        },
        danger: {
          DEFAULT: '#dc2626',
        },
      },
      fontFamily: {
        // PT-BR friendly: fallback system (Roboto no Android).
        // Sem webfonts no MVP - carregamento extra e YAGNI.
        sans: [
          'System',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      // Spacing: escala default Tailwind (nao over-engineerar).
      // Touch target >=44pt garantido via classes px-5 py-3 no Button.
    },
  },
  plugins: [],
};
