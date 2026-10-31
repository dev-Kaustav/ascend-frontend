import Home from "@/components/store/Home";
import { storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import { loadProductPages, productsPath } from "@/lib/store/catalogue.mjs";

// Public, identity-free seed: categories, brands and the whole published range as an anonymous
// visitor sees it (MRP only). A signed-in retailer's prices are fetched by the client after
// readiness; nothing private is rendered or cached on the server. Never statically cached.
export const dynamic = "force-dynamic";

// Own metadata: nested metadata objects replace the root's, so canonical, OG and Twitter are
// complete here. The share card (public/store/og-store.jpg, 1200 x 630) carries the promise in type
// over real snacks, so a WhatsApp or Google preview says what the store is at a glance.
const siteUrl = "https://ascendfoods.in";
const title = "Ascend: Snacks for your shop in 60 minutes";
const description = "Restock Jabsons, Crax and more for your shop, delivered in 60 minutes. Pay cash or UPI on delivery.";
const image = {
  url: "/store/og-store.jpg",
  width: 1200,
  height: 630,
  alt: "Snacks for your shop, in 60 minutes: puffs, roasted chana, bhujia and cashews"
};
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
  twitter: { card: "summary_large_image", title, description, images: [image.url] }
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
  const [categories, range] = await Promise.all([
    seed(() => publicGet(storeEndpoints.categories), "categories"),
    seed(() => loadProductPages(({ limit, offset }) => publicGet(productsPath({ limit, offset }))), "home-range")
  ]);
  return <Home seed={{ categories, range }} />;
}
