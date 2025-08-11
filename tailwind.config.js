
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // remap existing tokens to Chrome dark neutrals
        'uconn-blue': '#202124',     // page background
        'uconn-surface': '#303134',   // cards
        'uconn-text': '#e8eaed',      // primary text
        'uconn-muted': '#9aa0a6',     // secondary text
        'uconn-border': '#3c4043'     // borders/dividers
      }
    },
  },
  plugins: [],
}
