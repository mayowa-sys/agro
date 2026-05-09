const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        ojuju: ['Ojuju', 'sans-serif'],
        display: ['DM Serif Display', 'serif'],
        sans: ['DM Sans', ...fontFamily.sans],
      },
      colors: {
        leaf: {
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        clay: '#c8714a',
        cream: {
          100: '#fdf8f0',
          200: '#f7ede0',
        },
        ink: '#1a1410',
      },
    },
  },
  plugins: [],
};
