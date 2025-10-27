/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1F2937', // Gray-800 (primary accents/buttons)
        secondary: '#6B7280', // Gray-500 (secondary accents)
        background: '#ffffff', // White app background
        foreground: '#F3F4F6', // Gray-100 (text on dark)
      },
    },
  },
  plugins: [],
}