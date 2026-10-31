"use client";

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import {
  CatalogueError,
  CategoryTile,
  PUBLIC_VIEWER,
  ProductGrid,
  ProductShelf,
  ProductSkeletons,
  useResumePendingAdd,
  useScrollRetention,
  useViewer,
  useViewerResource
} from "@/components/store/Catalogue";
import { storeEndpoints } from "@/lib/store/api.mjs";
import {
  categoryCovers,
  groupShelves,
  listingHref,
  loadProductPages,
  productsPath,
  sortAvailableLast
} from "@/lib/store/catalogue.mjs";
import { FestiveBanner } from "@/components/store/Diwali";
import { FESTIVE } from "@/components/store/festive";

// The long shopping home (D-05, D-06), composed only from what the API returns:
//   compact promo, illustrated categories, category shelves, full range.
// A section with no data disappears. Nothing is repeated to make the page longer, and no sales,
// discount or delivery-time claim is made. The server seeds the public (MRP) data so the HTML is
// complete before any script runs; a ready retailer's prices are fetched by the client afterwards.

const fetchCategories = (get) => get(storeEndpoints.categories);
const fetchRange = (get, isCurrent) =>
  loadProductPages(({ limit, offset }) => get(productsPath({ limit, offset })), { isCurrent });

export default function Home({ seed = null }) {
  const viewer = useViewer();
  const promoId = useId();
  const categoriesId = useId();
  const rangeId = useId();
  useResumePendingAdd(viewer);

  const categories = useViewerResource({ id: "categories", viewer: PUBLIC_VIEWER, seed: seed?.categories, load: fetchCategories });
  const range = useViewerResource({ id: "home-range", viewer, seed: seed?.range, load: fetchRange });

  const categoryList = categories.data || [];
  const rangeReady = range.phase === "ready";
  const items = rangeReady ? sortAvailableLast(range.data.items) : [];
  const total = rangeReady ? range.data.total : 0;
  const shelves = rangeReady ? groupShelves(items, categoryList) : [];
  const covers = rangeReady ? categoryCovers(items) : {};

  useScrollRetention("/", rangeReady && !range.busy);

  const facts = rangeReady && total > 0 ? `${total} ${total === 1 ? "product" : "products"}` : null;

  return (
    <div className="store-home">
      {FESTIVE ? (
        <FestiveBanner headingId={promoId} facts={facts} categories={categoryList} covers={covers} />
      ) : (
        <>
          <section className="store-promo" data-home-section="promo" aria-labelledby="store-home-heading">
            <div className="store-promo__copy">
              <h1 id="store-home-heading">Stock your shop with Ascend</h1>
              <p>
                {facts ? `${facts} to choose from. ` : ""}Pay on delivery: cash or UPI.
              </p>
              <Link className="store-button" href="/products">
                Browse products
              </Link>
            </div>
            <div className="store-promo__art" aria-hidden="true">
              <Image src="/store/hero-snacks.jpg" alt="" fill priority sizes="(min-width: 1280px) 1200px, 100vw" />
            </div>
          </section>

          {categoryList.length > 0 ? (
            <section className="store-section" data-home-section="categories" aria-labelledby={categoriesId}>
              <div className="store-section__head">
                <h2 id={categoriesId}>Shop by category</h2>
                <Link href="/products?view=categories" className="store-see-all" aria-label="See all categories">
                  See all
                </Link>
              </div>
              <ul className="store-category-row" data-shelf-id="categories" style={{ "--cat-count": categoryList.length }}>
                {categoryList.map((category) => (
                  <CategoryTile key={category.id} category={category} coverUrl={covers[category.id]} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {range.phase === "error" ? (
        <CatalogueError onRetry={range.retry} />
      ) : !rangeReady ? (
        <ProductSkeletons count={4} />
      ) : items.length === 0 ? (
        <div className="store-state" data-home-section="empty">
          <h2>No products found</h2>
          <p>Check back soon.</p>
        </div>
      ) : (
        <>
          <div className="store-shelves" data-home-section="shelves" aria-busy={range.busy ? "true" : undefined}>
            {shelves.map(({ category, products }) => (
              // Each shelf is an aisle in its category tile's tint, matched by the category's place.
              <div
                key={category.id}
                className="store-aisle"
                data-tone={Math.max(0, categoryList.findIndex((item) => item.id === category.id)) % 4}
              >
                <ProductShelf
                  shelfId={`category-${category.id}`}
                  title={category.name}
                  href={listingHref({ categoryId: category.id })}
                  products={products}
                  viewer={viewer}
                />
              </div>
            ))}
          </div>

          <section className="store-section" data-home-section="range" aria-labelledby={rangeId}>
            <div className="store-section__head">
              <h2 id={rangeId}>All products</h2>
              <Link href="/products" className="store-see-all" aria-label="See all products">
                See all
              </Link>
            </div>
            <ProductGrid products={items} viewer={viewer} eagerCount={0} />
            {!range.data.complete ? (
              <Link className="store-text-link" href="/products">
                See all {total} products
              </Link>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
