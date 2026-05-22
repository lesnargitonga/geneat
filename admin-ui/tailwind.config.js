/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0b10",
        surface: "#11131c",
        surface2: "#171a26",
        border: "#262a3a",
        muted: "#7a8093",
        text: "#e8eaf2",
        brand: "#5b8cff",
        accent: "#8b5cf6",
        ok: "#34d399",
        warn: "#fbbf24",
        err: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(91,140,255,0.35), 0 8px 24px -8px rgba(91,140,255,0.45)",
      },
    },
  },
  plugins: [],
};
