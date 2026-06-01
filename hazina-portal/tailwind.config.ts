import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          DEFAULT: "rgb(var(--color-sand) / <alpha-value>)",
          dark: "rgb(var(--color-sand-dark) / <alpha-value>)",
        },
        cream: "rgb(var(--color-sand) / <alpha-value>)",
        obsidian: {
          DEFAULT: "rgb(var(--color-obsidian) / <alpha-value>)",
          soft: "rgb(var(--color-obsidian-soft) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          mute: "rgb(var(--color-ink-mute) / <alpha-value>)",
        },
        bronze: {
          DEFAULT: "rgb(var(--color-bronze) / <alpha-value>)",
          dark: "rgb(var(--color-bronze-dark) / <alpha-value>)",
          light: "rgb(var(--color-bronze-light) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--color-bronze) / <alpha-value>)",
          dark: "rgb(var(--color-bronze-dark) / <alpha-value>)",
          light: "rgb(var(--color-bronze-light) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
        },
        sage: {
          DEFAULT: "rgb(var(--color-sage) / <alpha-value>)",
          soft: "rgb(var(--color-sage-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Avenir Next", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        mono: ["DM Mono", "SFMono-Regular", "ui-monospace", "monospace"],
        display: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(28, 26, 23, 0.08)",
        editorial:
          "0 24px 48px -12px rgba(28, 26, 23, 0.18), 0 8px 16px -8px rgba(28, 26, 23, 0.08)",
        pop: "0 24px 48px -12px rgba(166, 124, 82, 0.25)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      maxWidth: {
        page: "1280px",
      },
      letterSpacing: {
        editorial: "0.2em",
      },
    },
  },
  plugins: [],
};

export default config;
