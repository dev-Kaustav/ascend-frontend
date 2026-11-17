import localFont from "next/font/local";
import "./app.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

// Staff workspace: never indexed, and it must not present the public store's identity.
// The staff workspace's one face. Variable weight; subset to Latin plus the rupee sign.
const geist = localFont({
  src: [{ path: "../fonts/geist-latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist",
  display: "swap"
});

export const metadata = {
  title: "Staff workspace",
  description: "Ascend staff workspace.",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "default-no-store";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function AppLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className={`${geist.variable} font-sans`}>{children}</div>
      </ToastProvider>
    </AuthProvider>
  );
}
