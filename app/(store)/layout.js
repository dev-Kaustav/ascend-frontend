import "./store.css";
import StoreShell from "@/components/store/StoreShell";
import { RetailerProvider } from "@/components/store/RetailerProvider";

// Phone-first: viewport-fit=cover lets env(safe-area-inset-bottom) report the home-indicator
// inset that the bottom navigation pads for.
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Store-only boundary: /login, /landing and /app stay outside this layout and its retailer
// state (D-02/D-04). The single root <html>/<body> remains in app/layout.js.
export default function StoreLayout({ children }) {
  return (
    <RetailerProvider>
      <StoreShell>{children}</StoreShell>
    </RetailerProvider>
  );
}
