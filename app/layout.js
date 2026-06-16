import Script from "next/script";
import { DM_Mono, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-marketing-display",
  display: "swap"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-marketing-body",
  display: "swap"
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-marketing-mono",
  display: "swap"
});

const siteUrl = "https://ascendfoods.in";
const siteName = "Ascend Foods";
const defaultTitle = "Ascend: Restock Any Shelf in Four Hours";
const defaultDescription =
  "Ascend connects store-level demand, nearby FMCG inventory, and four-hour fulfillment for India's kirana and convenience retailers.";
const defaultImage = "/ascend-conveyor.svg";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  description: defaultDescription,
  email: "kaustav@ascendfoods.in"
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Ascend"
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    "B2B quick commerce",
    "kirana restocking",
    "dark store delivery",
    "FMCG B2B",
    "retailer ordering",
    "India FMCG distribution"
  ],
  alternates: {
    canonical: "/"
  },
  creator: siteName,
  publisher: siteName,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: siteUrl,
    siteName,
    type: "website",
    images: [
      {
        url: defaultImage,
        width: 1200,
        height: 630,
        alt: "Ascend's industrial FMCG fulfillment system"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [defaultImage]
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1
  }
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${dmMono.variable}`}
    >
      <body className="antialiased font-sans">
        <Script
          id="organization-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
