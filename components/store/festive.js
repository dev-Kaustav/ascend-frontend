import localFont from "next/font/local";

// The seasonal skin for the storefront. Set FESTIVE to null to return to the everyday store; every
// festive rule in store.css is scoped under [data-festive="diwali"], so nothing else changes.
export const FESTIVE = "diwali";

export const festiveFont = localFont({
  src: [{ path: "../../app/fonts/yatra-one-latin.woff2", weight: "400", style: "normal" }],
  variable: "--font-festive",
  display: "swap"
});
