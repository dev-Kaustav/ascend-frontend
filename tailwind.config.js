/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — reference CSS variables defined in globals.css
        canvas:          "var(--color-bg)",
        surface:         "var(--color-surface)",
        "surface-soft":  "var(--color-surface-soft)",
        ink:             "var(--color-ink)",
        muted:           "var(--color-muted)",
        accent:          "var(--color-accent)",
        "accent-strong": "var(--color-accent-strong)",
        "accent-soft":   "var(--color-accent-soft)",
        sidebar:         "var(--color-sidebar)",
        // Static darks used only in sidebar decorative elements
        night:     "#0b0614",
        nightSoft: "#160b27",
        steel:     "#475569",
      },
      boxShadow: {
        soft: "0 20px 40px -24px rgba(15, 23, 42, 0.25)",
        card: "0 18px 40px -28px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

module.exports = config;
