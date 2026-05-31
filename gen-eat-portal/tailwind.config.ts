import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F5F0E8",
        ink: {
          DEFAULT: "#2C2C2C",
          soft: "#3D3D3D",
          mute: "#6B7280",
        },
        brand: {
          DEFAULT: "#C45C3E",   // terracotta
          dark: "#A84A30",
          light: "#F0D5CC",
        },
        sage: {
          DEFAULT: "#8B9A6B",
          soft: "#E8EDE0",
        },
        sand: "#F5E6CC",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"Inter"', "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(31,41,55,0.10)",
        pop: "0 18px 40px -16px rgba(196,92,62,0.30)",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
      maxWidth: {
        page: "1240px",
      },
    },
  },
  plugins: [],
};

export default config;
