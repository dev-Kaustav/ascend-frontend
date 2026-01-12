/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        accent: "#7c4dff",
        accentSoft: "#e6ddff",
        night: "#0b0614",
        nightSoft: "#160b27",
        mist: "#f8fafc",
        steel: "#475569"
      },
      boxShadow: {
        soft: "0 20px 40px -24px rgba(15, 23, 42, 0.25)",
        card: "0 18px 40px -28px rgba(15, 23, 42, 0.35)"
      }
    }
  },
  plugins: []
};

module.exports = config;
