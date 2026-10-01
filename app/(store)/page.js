import Link from "next/link";
import ProductImage from "@/components/store/ProductImage";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";

export const dynamic = "force-dynamic";

// Own metadata: the store is not the marketing page, so it must not carry its 60-minute claim.
// Nested metadata objects replace the root's, so canonical, OG and Twitter are complete here.
const siteUrl = "https://ascendfoods.in";
const title = "Ascend Foods: Jabsons snacks for retailers";
const description = "Browse the Ascend range. Pay on delivery.";
const image = { url: "/ascend-logo.png", width: 512, height: 512, alt: "Ascend Foods logo" };
export const metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/`,
    siteName: "Ascend Foods",
    type: "website",
    images: [image]
  },
  twitter: { card: "summary", title, description, images: [image.url] }
};

const mrp = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

async function loadSeedProduct() {
  try {
    const page = await storeFetch(`${storeEndpoints.products}?limit=1`, { public: true });
    return { product: page?.items?.[0] ?? null, failed: false };
  } catch {
    return { product: null, failed: true };
  }
}

export default async function StoreHomePage() {
  const { product, failed } = await loadSeedProduct();

  return (
    <section className="store-state" aria-labelledby="store-home-heading">
      <h1 id="store-home-heading">Ascend range</h1>

      {failed ? (
        <div className="store-state" role="alert">
          <p>We couldn&apos;t load products. Please try again.</p>
          <Link className="store-button" href="/">
            Try again
          </Link>
        </div>
      ) : !product ? (
        <p>No products found. Check back soon.</p>
      ) : (
        <article
          className="store-card"
          style={{ maxWidth: 240 }}
          data-store-product-id={product.id}
          aria-label={product.name}
        >
          <ProductImage src={product.image_url} />
          <h2>{product.name}</h2>
          {product.pack_size ? <p>{product.pack_size}</p> : null}
          <p>MRP {mrp.format(product.mrp)}</p>
          <p>{product.in_stock ? "In stock" : "Out of stock"}</p>
        </article>
      )}
    </section>
  );
}
