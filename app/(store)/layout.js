import Link from "next/link";

// Store-only boundary: /login, /landing and /app stay outside this layout and its retailer
// state (D-02/D-04). The single root <html>/<body> remains in app/layout.js.
export default function StoreLayout({ children }) {
  return (
    <div className="ascend-storefront">
      <main id="main">{children}</main>
      <footer>
        <Link href="/landing">About Ascend</Link> · <Link href="/login">Staff sign in</Link>
      </footer>
    </div>
  );
}
