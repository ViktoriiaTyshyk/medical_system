import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    { DEFAULT: '#060c1a', 50: '#0a1122', 100: '#0d1629', 200: '#111e35' },
        surface: { DEFAULT: '#0f172a', 50: '#131f34', 100: '#172240', 200: '#1c2a4a' },
        panel:   { DEFAULT: '#1a2640', 50: '#1e2d4a', 100: '#243354' },
        line:    { DEFAULT: '#243354', muted: '#1a2640' },
        ink:     { DEFAULT: '#e8f0fe', muted: '#8898c0', subtle: '#4e6080' },
        sky:     { DEFAULT: '#4f8ef7', dark: '#3a7ae0', glow: 'rgba(79,142,247,0.15)' },
        jade:    { DEFAULT: '#22c55e', dark: '#16a34a', glow: 'rgba(34,197,94,0.12)'  },
        amber:   { DEFAULT: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
        rose:    { DEFAULT: '#ef4444', glow: 'rgba(239,68,68,0.12)'  },
      },
      borderRadius: {
        sm: '6px', DEFAULT: '10px', md: '12px',
        lg: '14px', xl: '18px', '2xl': '22px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.25)',
        glow: '0 0 0 3px rgba(79,142,247,0.2)',
        modal: '0 20px 60px rgba(0,0,0,0.6)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: {
        'fade-in':    'fadeIn .15s ease-out',
        'slide-up':   'slideUp .2s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':   'scaleIn .2s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow':  'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity:'0', transform:'translateY(10px)' }, to: { opacity:'1', transform:'translateY(0)' } },
        scaleIn: { from: { opacity:'0', transform:'scale(0.96)' }, to: { opacity:'1', transform:'scale(1)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
