import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#C8102E',
          600: '#C8102E',
          700: '#a50d25',
          900: '#6b0818',
        },
        accent: {
          500: '#C8102E',
          600: '#a50d25',
          700: '#6b0818',
        },
        compliance: {
          green: '#34C759',
          yellow: '#FF9500',
          red: '#FF3B30',
        },
        surface: {
          DEFAULT: '#F2F2F7',
          card: '#FFFFFF',
          border: '#E5E5EA',
          muted: '#8E8E93',
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
