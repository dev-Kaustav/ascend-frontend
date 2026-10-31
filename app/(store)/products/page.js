import { ProductListing } from "@/components/store/Catalogue";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  DEFAULT_LISTING_LIMIT,
  pageOffset,
  parseListingParams,
  productQuery,
  productsPath
} from "@/lib/store/catalogue.mjs";

// Public, identity-free listing. The page awaits searchParams (Next 16), parses them into the
// same filters the client uses, and seeds the first public page so the HTML already holds real
// products. A signed-in retailer's prices are fetched by the client afterwards, never here
// (no private data is rendered or cached on the server).
export const dynamic = "force-dynamic";

const siteUrl = "https://ascendfoods.in";
const description = "Browse snacks for your shop: Jabsons, Crax and more, delivered in 60 minutes. Pay cash or UPI on delivery.";
const image = { url: "/store/og-store.jpg", width: 1200, height: 630, alt: "Snacks for your shop, in 60 minutes" };

export async function generateMetadata({ searchParams }) {
  const params = parseListingParams(await searchParams);
  const title = "Products | Ascend Foods";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/products" },
    // A search result page is not a page worth indexing; the plain listing and categories are.
    robots: params.q ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: `${siteUrl}/products`, siteName: "Ascend Foods", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] }
  };
}

async function seedPublic(path, id) {
  try {
    return { id, data: await storeFetch(path, { public: true }) };
  } catch {
    return null;
  }
}

export default async function ProductsPage({ searchParams }) {
  const params = parseListingParams(await searchParams);
  const query = { q: params.q, categoryId: params.categoryId, brandId: params.brandId };
  const limit = DEFAULT_LISTING_LIMIT;
  const offset = pageOffset(params.page, limit);

  const [products, categories, brands] = await Promise.all([
    params.view === "categories"
      ? null
      : seedPublic(productsPath({ ...query, limit, offset }), productQuery({ ...query, limit, offset })),
    seedPublic(storeEndpoints.categories, "categories"),
    seedPublic(storeEndpoints.brands, "brands")
  ]);

  return <ProductListing params={params} seed={{ products, categories, brands }} />;
}
