import localFont from "next/font/local";
import "./globals.css";
import NumberInputWheelGuard from "@/components/ui/NumberInputWheelGuard";

const sora = localFont({
  src: [
    { path: "./fonts/sora-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/sora-latin.woff2", weight: "600", style: "normal" }
  ],
  variable: "--font-marketing-display",
  display: "swap"
});

const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin.woff2", weight: "600", style: "normal" }
  ],
  variable: "--font-marketing-body",
  display: "swap"
});

const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" }
  ],
  variable: "--font-marketing-mono",
  display: "swap"
});

const siteUrl = "https://ascendfoods.in";
const siteName = "Ascend Foods";
// Root defaults describe the B2B store at "/"; /landing sets its own complete metadata.
const defaultTitle = "Ascend: Snacks for your shop in 60 minutes";
const defaultDescription = "Restock Jabsons, Crax and more for your shop, delivered in 60 minutes. Pay cash or UPI on delivery.";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  description: "Ascend Foods delivers snacks to retailers in 60 minutes.",
  // Distinct from the favicon: this is the logo Google can attach to the brand itself.
  logo: `${siteUrl}/ascend-logo.png`,
  email: "pranshu@ascendfoods.in",
  areaServed: "Gurugram and Delhi NCR, India"
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Ascend"
  },
  description: defaultDescription,
  applicationName: siteName,
  // No canonical, OG url, OG image or keywords here: nested metadata is inherited by every
  // route, so each public route (/, /landing, /privacy-policy) declares its own and the
  // private ones (/login, /app) opt out of indexing.
  creator: siteName,
  publisher: siteName,
  openGraph: {
    siteName,
    type: "website"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }]
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
      className={`${sora.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="antialiased font-sans">
        <script
          id="organization-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <NumberInputWheelGuard />
        {children}
      </body>
    </html>
  );
}
