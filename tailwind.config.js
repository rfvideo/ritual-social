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
          DEFAULT: '#FDFBF6',
          100: '#F6F1E7',
          200: '#EFE7D3',
          300: '#E4D9BE',
        },
        ash: {
          DEFAULT: '#EFE7D3',
          100: '#F0EADA',
          200: '#D8CBA6',
          300: '#C2B287',
        },
        ritual: {
          DEFAULT: '#0B3D28',
          50: '#E9F0EA',
          100: '#CFE0D2',
          200: '#9FC1A5',
          300: '#5C8F68',
          400: '#255C3D',
          500: '#0B3D28',
          600: '#082A1B',
          700: '#061D13',
          800: '#04140D',
          900: '#020C07',
        },
        gold: {
          DEFAULT: '#A8874F',
          light: '#C9A868',
          dark: '#8A6E3D',
        },
        mist: {
          DEFAULT: '#7A6F55',
          light: '#1C1710',
          dim: '#948868',
        },
      },
      backgroundImage: {
        'ritual-gradient': 'linear-gradient(135deg, #255C3D 0%, #082A1B 100%)',
        'ritual-radial': 'radial-gradient(circle at 50% 0%, rgba(11,61,40,0.10), transparent 60%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        glow: '0 2px 16px rgba(11,61,40,0.18)',
        'glow-lg': '0 8px 40px rgba(11,61,40,0.15)',
        'glow-sm': '0 1px 8px rgba(11,61,40,0.20)',
        edge: 'inset 0 1px 0 0 rgba(255,255,255,0.6)',
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
