// tailwind.config.js (ESM)
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"], // keep class-based theming
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,mdx}",
    "./content/**/*.{md,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },

      // --- App tokens (hex where you used them directly) ---
      colors: {
        // Navy set used by Attendance card
        surface: "#0F1B3A",
        border: "#1f2a44",

        // Overlays used in the Gantt header (rgb vars defined in CSS below)
        overlay: {
          6: "rgb(var(--overlay-6))",
          10: "rgb(var(--overlay-10))",
        },

        // Keep shadcn aliases working (driven by CSS variables below)
        background: "hsl(var(--bg))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        mutedToken: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" }, // avoid name clash with hex `muted` above
        accentToken: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Extras you referenced
        "accent-weak": "#98D7D8",
        success: "#34D399",
        warning: "#FACC15",
        danger: "#BE2D2D",

        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },

      letterSpacing: { caps: "0.08em" },
      borderRadius: {
        "2xl": "1rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.25)",
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "var(--text)",
            "--tw-prose-headings": "var(--text)",
            "--tw-prose-links": "var(--accent)",
            "--tw-prose-bullets": "var(--muted)",
            a: { textDecoration: "none", fontWeight: "600" },
            "a:hover": { textDecoration: "underline" },
            img: { borderRadius: "0.75rem", boxShadow: "0 6px 16px rgba(0,0,0,.08)" },
            code: {
              backgroundColor: "rgba(0,0,0,.04)",
              padding: "0.15rem 0.35rem",
              borderRadius: "0.375rem",
            },
          },
        },
      },
    },
  },
  plugins: [animate, require("@tailwindcss/typography")],
};
