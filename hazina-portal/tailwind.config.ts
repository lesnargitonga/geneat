import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          DEFAULT: "#FAF8F5",
          dark: "#F0EBE3",
        },
        cream: "#FAF8F5",
        obsidian: {
          DEFAULT: "#1C1A17",
          soft: "#2A2723",
        },
        ink: {
          DEFAULT: "#1C1A17",
          soft: "#2A2723",
          mute: "#5C564E",
        },
        bronze: {
          DEFAULT: "#A67C52",
          dark: "#8B6642",
          light: "#C9A882",
        },
        brand: {
          DEFAULT: "#A67C52",
          dark: "#8B6642",
          light: "#C9A882",
        },
        border: {
          DEFAULT: "#EAE6DF",
        },
        sage: {
          DEFAULT: "#8B9A6B",
          soft: "#E8EDE0",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
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
