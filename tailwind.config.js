/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mpt: {
          blue: '#1e3a8a', // Azul institucional
          gold: '#eab308', // Dorado/Amarillo de acento
        }
      }
    },
  },
  plugins: [],
}