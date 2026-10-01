import { cache } from "react";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/store/ProductDetail";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { parseProductId, productsPath } from "@/lib/store/catalogue.mjs";

// Public product page. The server reads the product anonymously (MRP, stock state) for the
// metadata and the first paint; a signed-in retailer's trade price is fetched by the client.
// An unknown or unpublished product is a real 404 inside the store shell (see not-found.js).
export const dynamic = "force-dynamic";

const siteUrl = "https://ascendfoods.in";

const readProduct = cache(async (id) => {
  try {
    return { product: await storeFetch(storeEndpoints.product(id), { public: true }), status: 200 };
  } catch (error) {
    return { product: null, status: error?.status ?? 0 };
  }
});

export async function generateMetadata({ params }) {
  const id = parseProductId((await params).id);
  const { product } = id === null ? { product: null } : await readProduct(id);
  if (!product) return { title: { absolute: "Product not available | Ascend Foods" }, robots: { index: false, follow: true } };

  const title = `${product.name} | Ascend Foods`;
  const description = [product.name, product.pack_size, `by ${product.brand.name}`].filter(Boolean).join(", ") + ". Pay on delivery.";
  const images = typeof product.image_url === "string" && product.image_url.startsWith("https://") ? [{ url: product.image_url, alt: product.name }] : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: { title, description, url: `${siteUrl}/products/${product.id}`, siteName: "Ascend Foods", type: "website", images },
    twitter: { card: "summary", title, description, images: images?.map((image) => image.url) }
  };
}

export default async function ProductPage({ params }) {
  const id = parseProductId((await params).id);
  if (id === null) notFound();

  const { product, status } = await readProduct(id);
  if (!product && status === 404) notFound();

  let similar = null;
  if (product) {
    const similarId = `similar:${product.category.id}`;
    try {
      similar = { id: similarId, data: await storeFetch(productsPath({ categoryId: product.category.id, limit: 13 }), { public: true }) };
    } catch {
      similar = null;
    }
  }

  return <ProductDetail id={id} seed={{ product: product ? { id: `product:${id}`, data: product } : null, similar }} />;
}
