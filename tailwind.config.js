/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-blue': '#00f2ff',
        'cyber-pink': '#ff00ff',
        'cyber-purple': '#9d00ff',
        'cyber-dark': '#0a0e27',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 242, 255, 0.8)',
        'neon-pink': '0 0 20px rgba(255, 0, 255, 0.8)',
      }
    },
  },
  plugins: [],
}
