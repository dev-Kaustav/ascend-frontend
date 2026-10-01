import Link from "next/link";

// Rendered inside the store shell when a store page calls notFound() (an unknown or unpublished
// product), with a real 404 status.
export const metadata = { title: { absolute: "Not available | Ascend Foods" }, robots: { index: false, follow: true } };
export default function StoreNotFound() {
  return (
    <section className="store-state" aria-labelledby="store-not-found">
      <h1 id="store-not-found">This product isn&apos;t available</h1>
      <p>It may have been removed, or the link may be wrong.</p>
      <Link className="store-button" href="/products">
        Browse products
      </Link>
    </section>
  );
}
