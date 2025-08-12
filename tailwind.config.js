
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"],
      },
      colors: {
        // Core UI tokens
        'uconn-blue': '#000E2F',      // Navy blue background
        'uconn-surface': '#0f1b3a',   // Slightly lighter surface on dark
        'uconn-text': '#FFFFFF',      // primary text
        'uconn-muted': '#BDC0C3',     // secondary text
        'uconn-border': '#24304f',    // borders/dividers

        // Extended palette from user brief
        brand: {
          navy: '#000E2F',
          blue: '#004369',
          tealGrey: '#79AFBA',
          teal: '#64C7C9',
          lightTeal: '#98D7D8',
          yellow: '#FFDA30',
          orange: '#EE6921',
          red: '#BE2D2D',
          darkGrey: '#7e868C',
          lightGrey: '#BDC0C3',
          black: '#000000',
        }
      }
    },
  },
  plugins: [],
}
