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
  findFeatureBrand,
  groupShelves,
  listingHref,
  loadProductPages,
  productsPath,
  sortAvailableLast
} from "@/lib/store/catalogue.mjs";

// The long shopping home (D-05, D-06), composed only from what the API returns:
//   compact promo, illustrated categories, featured brand, category shelves, full range.
// A section with no data disappears. Nothing is repeated to make the page longer, and no sales,
// discount or delivery-time claim is made. The server seeds the public (MRP) data so the HTML is
// complete before any script runs; a ready retailer's prices are fetched by the client afterwards.

const fetchCategories = (get) => get(storeEndpoints.categories);
const fetchBrands = (get) => get(storeEndpoints.brands);
const fetchRange = (get, isCurrent) =>
  loadProductPages(({ limit, offset }) => get(productsPath({ limit, offset })), { isCurrent });

export default function Home({ seed = null }) {
  const viewer = useViewer();
  const categoriesId = useId();
  const rangeId = useId();
  useResumePendingAdd(viewer);

  const categories = useViewerResource({ id: "categories", viewer: PUBLIC_VIEWER, seed: seed?.categories, load: fetchCategories });
  const brands = useViewerResource({ id: "brands", viewer: PUBLIC_VIEWER, seed: seed?.brands, load: fetchBrands });
  const range = useViewerResource({ id: "home-range", viewer, seed: seed?.range, load: fetchRange });

  const categoryList = categories.data || [];
  const rangeReady = range.phase === "ready";
  const items = rangeReady ? sortAvailableLast(range.data.items) : [];
  const total = rangeReady ? range.data.total : 0;
  const shelves = rangeReady ? groupShelves(items, categoryList) : [];
  const feature = rangeReady ? findFeatureBrand(brands.data, items) : null;
  const covers = rangeReady ? categoryCovers(items) : {};

  useScrollRetention("/", rangeReady && !range.busy);

  const facts = rangeReady && total > 0 ? `${total} ${total === 1 ? "product" : "products"}` : null;

  return (
    <div className="store-home">
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
          <ul className="store-category-row" data-shelf-id="categories">
            {categoryList.map((category) => (
              <CategoryTile key={category.id} category={category} coverUrl={covers[category.id]} />
            ))}
          </ul>
        </section>
      ) : null}

      {feature ? (
        <section className="store-feature" data-home-section="feature" aria-label={`Featured brand: ${feature.brand.name}`}>
          <div className="store-feature__copy">
            <p className="store-feature__label">Featured brand</p>
            <h2>{feature.brand.name}</h2>
            <p>{feature.count === 1 ? "1 product" : `${feature.count} products`}</p>
            <Link className="store-button" href={listingHref({ brandId: feature.brand.id })}>
              Shop {feature.brand.name}
            </Link>
          </div>
          {feature.thumbs.length > 0 ? (
            <ul className="store-feature__art" aria-hidden="true">
              {feature.thumbs.map((url) => (
                <li key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote host is not whitelisted for next/image */}
                  <img src={url} alt="" width={96} height={96} loading="lazy" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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
              <ProductShelf
                key={category.id}
                shelfId={`category-${category.id}`}
                title={category.name}
                href={listingHref({ categoryId: category.id })}
                products={products}
                viewer={viewer}
              />
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
