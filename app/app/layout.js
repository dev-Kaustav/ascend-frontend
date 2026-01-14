import { Manrope, Space_Grotesk } from "next/font/google";
import "./app.css";

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export default function AppLayout({ children }) {
  return <div className={`${body.variable} ${display.variable}`}>{children}</div>;
}
