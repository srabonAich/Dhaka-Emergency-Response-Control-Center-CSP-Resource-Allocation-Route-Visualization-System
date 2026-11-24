/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkbg: '#0b0f19',
        panelbg: '#111827',
        bordercolor: '#1f2937',
      }
    },
  },
  plugins: [],
}
