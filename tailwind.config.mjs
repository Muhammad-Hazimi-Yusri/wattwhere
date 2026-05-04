/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Okabe-Ito categorical palette for fuel types
        fuel: {
          black: '#000000',
          orange: '#E69F00',
          skyblue: '#56B4E9',
          green: '#009E73',
          yellow: '#F0E442',
          blue: '#0072B2',
          vermillion: '#D55E00',
          purple: '#CC79A7',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
