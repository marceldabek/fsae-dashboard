
/**
 * Lean design token Tailwind config (hard reset to minimal system).
 * Old color classes (uconn-*, brand.*) removed intentionally.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "Noto Sans"
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace"
        ]
      },
      colors: {
        bg: '#000E2F',
        surface: '#0F1B3A',
        border: '#24304F',
        text: '#FFFFFF',
        muted: '#BDC0C3',
        accent: '#64C7C9',
        'accent-weak': '#98D7D8',
        success: '#34D399',
        warning: '#FACC15',
        danger: '#BE2D2D',
        overlay: {
          6: 'rgba(255,255,255,0.06)',
          10: 'rgba(255,255,255,0.10)'
        }
      },
      fontSize: {
        xs: ['12px', '18px'],
        sm: ['14px', '22px'],
        lg: ['18px', '28px'],
        '2xl': ['24px', '32px'],
        tick: ['11px', '14px'] // chart ticks ONLY
      },
      letterSpacing: {
        caps: '0.08em'
      }
    }
  },
  plugins: []
}
