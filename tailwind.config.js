/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fragment Mono"', 'ui-monospace', 'monospace'],
        body: ['"General Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: {
          DEFAULT: '#050706',
          100: '#0a0d0b',
          200: '#0e1210',
          300: '#141917',
        },
        ash: {
          DEFAULT: '#1a1f1d',
          100: '#202622',
          200: '#2a312c',
          300: '#3a4239',
        },
        ritual: {
          DEFAULT: '#3AF075',
          50: '#e8fff0',
          100: '#c5ffdd',
          200: '#8dffb8',
          300: '#5df794',
          400: '#3AF075',
          500: '#22c95a',
          600: '#149c45',
          700: '#0e7534',
          800: '#0a4f24',
          900: '#062f16',
        },
        mist: {
          DEFAULT: '#9AA69E',
          light: '#C8D2CB',
          dim: '#5C6660',
        },
      },
      backgroundImage: {
        'ritual-gradient': 'linear-gradient(135deg, #3AF075 0%, #149c45 100%)',
        'ritual-radial': 'radial-gradient(circle at 50% 0%, rgba(58,240,117,0.15), transparent 60%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        glow: '0 0 24px rgba(58,240,117,0.35)',
        'glow-lg': '0 0 60px rgba(58,240,117,0.25)',
        'glow-sm': '0 0 12px rgba(58,240,117,0.4)',
        edge: 'inset 0 1px 0 0 rgba(255,255,255,0.04)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.5, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.05)' },
        },
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        riseIn: 'riseIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};
