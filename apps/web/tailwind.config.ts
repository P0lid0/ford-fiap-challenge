import type { Config } from 'tailwindcss';

/**
 * Paleta Ford oficial (FordMotor brand book + adaptações para web).
 * - ford-blue: oval Ford histórico (#003478)
 * - performance-blue: cor de acento (Mustang/ST line)
 * - ice / slate / charcoal: cinzas oficiais
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // === Ford brand ===
        ford: {
          blue:         '#003478', // oval Ford
          'blue-dark':  '#001A3D',
          'blue-deep':  '#000A1F', // background super escuro
          'blue-light': '#1E4B8E',
          'blue-soft':  '#D6E1F0', // tint para hover/cards claros
          performance:  '#1700F4', // performance blue (acento, Mustang/ST)
          accent:       '#0066B2', // Ford lake/ocean blue
        },
        // === Cinzas Ford ===
        ice:        '#F0EFEF', // off-white "Frozen White"
        slate:      '#4D4D4D',
        charcoal:   '#1A1A1A',
        // === Estados ===
        success:    '#00843D',
        warning:    '#F2A900',
        danger:     '#D62828',
        info:       '#0066B2',
        // gray escalas (compat com classes existentes)
        gray: {
          50:  '#F8F9FA',
          100: '#F0F1F3',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        script: ['"Dancing Script"', 'Brush Script MT', 'cursive'],
      },
      borderRadius: { xl: '16px', '2xl': '24px', '3xl': '32px' },
      boxShadow: {
        'soft':     '0 2px 8px rgba(0, 26, 61, 0.06)',
        'card':     '0 4px 16px rgba(0, 26, 61, 0.08)',
        'elevated': '0 12px 40px rgba(0, 26, 61, 0.14)',
        'glow':     '0 0 24px rgba(0, 102, 178, 0.35)',
      },
      backgroundImage: {
        'ford-gradient': 'linear-gradient(135deg, #003478 0%, #001A3D 100%)',
        'ford-radial':   'radial-gradient(circle at 30% 20%, #1E4B8E 0%, #001A3D 70%)',
        'ford-mesh':     'linear-gradient(135deg, #001A3D 0%, #003478 35%, #0066B2 100%)',
      },
      animation: {
        'fade-in':  'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
};
export default config;
