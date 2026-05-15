/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'system-ui', 'sans-serif'],
        display: ["'Sora'", "'Plus Jakarta Sans'", 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace']
      },
      colors: {
        primary: {
          50:  '#f0f6fc',
          100: '#e0edf8',
          200: '#b8d5ee',
          300: '#7fb8e0',
          400: '#4199cf',
          500: '#0F4C81',
          600: '#0d3f6b',
          700: '#0a3358',
          800: '#082a48',
          900: '#061f36',
        },
        cyan: {
          DEFAULT: '#00C2FF',
          50:  '#e6f9ff',
          100: '#ccf3ff',
          500: '#00C2FF',
          600: '#00a3d6',
        },
        accent: {
          light: '#e6f9ff',
          DEFAULT: '#00C2FF',
          dark: '#0099cc',
        },
        brand: {
          blue:   '#0F4C81',
          cyan:   '#00C2FF',
          green:  '#2ECC71',
          orange: '#FF9F43',
          bg:     '#F8FBFD',
          text:   '#0B1320',
          border: '#E6EEF5',
          teal:   '#20B2AA',
        },
      },
      animation: {
        'fade-in':  'fadeIn .4s ease forwards',
        'slide-up': 'slideUp .5s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bounce-dot': 'bounceDot 1.4s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'counter': 'counter 2s ease-out forwards',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
        bounceDot: { '0%,60%,100%': { transform: 'translateY(0)' }, '30%': { transform: 'translateY(-8px)' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(15,76,129,0.25)',
        'glow-accent':  '0 0 20px rgba(0,194,255,0.25)',
        'card': '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.12)',
        'premium': '0 20px 60px rgba(15,76,129,0.12)',
      }
    }
  },
  plugins: []
}
