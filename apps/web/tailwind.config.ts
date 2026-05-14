import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ford: {
          blue:      '#003478',
          'blue-dark':'#001A3D',
          'blue-light':'#1E4B8E',
        },
        gray: {
          50:  '#F5F5F5',
          100: '#EEEEEE',
          300: '#D9D9D9',
          400: '#BDBDBD',
          600: '#6B6B6B',
          800: '#3A3A3A',
        },
        success: '#00843D',
        warning: '#F2A900',
        danger:  '#D62828',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '16px', '2xl': '24px' },
    },
  },
  plugins: [],
};
export default config;
