import Home from "@/components/store/Home";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { loadProductPages, productsPath } from "@/lib/store/catalogue.mjs";

// Public, identity-free seed: categories, brands and the whole published range as an anonymous
// visitor sees it (MRP only). A signed-in retailer's prices are fetched by the client after
// readiness; nothing private is rendered or cached on the server. Never statically cached.
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

async function seed(load, id) {
  try {
    return { id, data: await load() };
  } catch {
    return null;
  }
}

export default async function StoreHomePage() {
  const publicGet = (path) => storeFetch(path, { public: true });
  const [categories, brands, range] = await Promise.all([
    seed(() => publicGet(storeEndpoints.categories), "categories"),
    seed(() => publicGet(storeEndpoints.brands), "brands"),
    seed(() => loadProductPages(({ limit, offset }) => publicGet(productsPath({ limit, offset }))), "home-range")
  ]);
  return <Home seed={{ categories, brands, range }} />;
}
