import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from "next/font/google";
import "./globals.css";
import NumberInputWheelGuard from "@/components/ui/NumberInputWheelGuard";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-marketing-display",
  display: "swap"
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-marketing-body",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-marketing-mono",
  display: "swap"
});

const siteUrl = "https://ascendfoods.in";
const siteName = "Ascend Foods";
// Root defaults describe the B2B store at "/" and carry no delivery-time promise. The marketing
// copy (60-minute restocking) belongs to /landing, which sets its own complete metadata.
const defaultTitle = "Ascend Foods: Jabsons snacks for retailers";
const defaultDescription = "Browse the Ascend range of Jabsons snacks for retailers. Pay on delivery.";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  // Neutral facts only: this block is emitted on every route, so no delivery-time claim here.
  description: "Ascend Foods supplies Jabsons snacks to retailers.",
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
