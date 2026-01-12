import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Ascend – Data-driven FMCG Distribution",
  description:
    "Ascend helps FMCG brands scale across India using data-driven distribution and GTM intelligence.",
  metadataBase: new URL("https://ascendfoods.in")
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
