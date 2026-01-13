import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const siteUrl = "https://ascendfoods.in";
const siteName = "Ascend Foods";
const defaultTitle = "Ascend – Data-driven FMCG Distribution";
const defaultDescription =
  "Ascend helps FMCG brands scale across India using data-driven distribution and GTM intelligence.";
const defaultImage = "/hero-dashboard.svg";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  description: defaultDescription,
  email: "partnerships@ascendfoods.in"
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
    "FMCG distribution",
    "GTM intelligence",
    "distribution network",
    "retail order capture",
    "sales analytics",
    "India FMCG"
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
        width: 640,
        height: 480,
        alt: "Ascend distribution intelligence dashboard"
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
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
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
