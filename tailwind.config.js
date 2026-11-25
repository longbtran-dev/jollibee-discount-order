/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      scale: {
        98: '0.98'
      },
      colors: {
        jollibee: {
          red: '#d71920',
          redDark: '#b81218',
          yellow: '#ffc72c',
          yellowDark: '#f5b81b',
          cream: '#fffaf0'
        }
      }
    }
  },
  plugins: []
};
