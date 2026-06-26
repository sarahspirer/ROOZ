import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea6c0a',
          700: '#c2570a',
          900: '#7c2d12',
        },
        accent: {
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        compliance: {
          green: '#22c55e',
          yellow: '#f97316',
          red: '#ef4444',
        },
        surface: {
          DEFAULT: '#080808',
          card: '#111111',
          border: '#1f1f1f',
          muted: '#555555',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scroll-up': 'scrollUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        scrollUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
