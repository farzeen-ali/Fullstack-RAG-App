/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080C',
          900: '#0C0E14',
          850: '#11141C',
          800: '#171B26',
          700: '#232837',
          600: '#323949',
        },
        brand: {
          50: '#EEF0FF',
          100: '#DFE3FF',
          200: '#C2C9FF',
          300: '#9DA6FF',
          400: '#7C83FD',
          500: '#6366F1',
          600: '#5148E5',
          700: '#4338CA',
        },
      },
    },
  },
  plugins: [],
};
