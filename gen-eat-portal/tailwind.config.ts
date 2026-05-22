import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8EE",
        ink: {
          DEFAULT: "#1F2937",
          soft: "#374151",
          mute: "#6B7280",
        },
        brand: {
          DEFAULT: "#FF6A3D",   // warm orange
          dark: "#E5552B",
          light: "#FFE0D2",
        },
        lime: {
          DEFAULT: "#B8E600",
          soft: "#E8F8B0",
        },
        sand: "#F5E6CC",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"Inter"', "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(31,41,55,0.10)",
        pop: "0 18px 40px -16px rgba(255,106,61,0.35)",
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
