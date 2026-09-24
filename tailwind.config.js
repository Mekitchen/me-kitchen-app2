/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7f4',
          100: '#dcede4',
          200: '#b9dbca',
          300: '#8cc2aa',
          400: '#5fa587',
          500: '#3d8a6b',
          600: '#2c6f55',
          700: '#245945',
          800: '#1e4738',
          900: '#1a3b2f',
        },
        ink: {
          50: '#f6f7f8',
          100: '#eceef1',
          200: '#d5d9e0',
          300: '#b1b9c5',
          400: '#8590a3',
          500: '#667187',
          600: '#525b6f',
          700: '#434a5a',
          800: '#393e4b',
          900: '#23262e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
