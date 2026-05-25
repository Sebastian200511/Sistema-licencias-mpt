
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // ¡Esta línea es vital!
  ],
  theme: {
    extend: {
      colors: {
        'mpt-blue': '#1e3a8a', // Tu color corporativo
      }
    },
  },
  plugins: [],
}