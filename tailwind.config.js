/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#242424',
        foreground: '#F5F2EC',
        primary: {
          DEFAULT: '#E8593F',
          foreground: '#F5F2EC',
        },
        secondary: {
          DEFAULT: '#ABF768',
          foreground: '#242424',
        },
        card: {
          DEFAULT: '#2E2E2E',
          foreground: '#F5F2EC',
        },
        muted: {
          DEFAULT: '#333333',
          foreground: '#888880',
        },
        border: 'rgba(255,255,255,0.08)',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
      },
      maxWidth: {
        '7xl': '80rem',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 22s linear infinite',
      },
    },
  },
  plugins: [],
}
