import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Personal Finance Platform — Aura-based preset (teal primary, warm neutrals).
 */
export const PfpPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e8f5f2',
      100: '#ccebe3',
      200: '#99d6c7',
      300: '#66c2ab',
      400: '#33ad8f',
      500: '#0d9488',
      600: '#0b7a71',
      700: '#096159',
      800: '#064741',
      900: '#042e2a',
      950: '#021816',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafb',
          100: '#f1f5f7',
          200: '#e2e8ee',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
    },
  },
});
