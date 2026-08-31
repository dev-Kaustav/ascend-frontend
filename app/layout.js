import Script from "next/script";
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
const defaultTitle = "Ascend: Snack Restocking in 60 Minutes";
const defaultDescription =
  "Ascend helps India's kirana and convenience retailers restock snacks and namkeen from nearby inventory within a 60-minute delivery window.";
const defaultImage = "/ascend-kirana-restock.webp";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  description: defaultDescription,
  email: "pranshu@ascendfoods.in"
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
    "Snacks B2B distribution",
    "retailer ordering",
    "India snacks distribution"
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
        width: 1536,
        height: 1024,
        alt: "A kirana owner restocking everyday products with Ascend"
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
      className={`${sora.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="antialiased font-sans">
        <Script
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
