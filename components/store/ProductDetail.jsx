"use client";

import Link from "next/link";
import {
  CatalogueError,
  PriceBlock,
  ProductShelf,
  PurchaseControl,
  useResumePendingAdd,
  useScrollRetention,
  useViewer,
  useViewerResource
} from "@/components/store/Catalogue";
import ProductImage from "@/components/store/ProductImage";
import { storeEndpoints } from "@/lib/store/api.mjs";
import { isAvailable, listingHref, packOf, piecesLabel, productsPath, similarProducts } from "@/lib/store/catalogue.mjs";

// One product: one real image, its full name, brand, net weight, the viewer's price and the
// purchase control, then real products from the same category (never itself). Nothing the
// catalogue does not hold is invented: no description, gallery or nutrition. Optional data that
// is missing (image, weight) simply is not shown.

const SIMILAR_LIMIT = 10;

function DetailSkeleton() {
  return (
    <div className="store-detail" aria-busy="true">
      <p className="sr-only" role="status">
        Loading product
      </p>
      <div className="store-detail__image">
        <div className="store-skeleton-tile" />
      </div>
      <div className="store-detail__info" aria-hidden="true">
        <div className="store-skeleton-bar" />
        <div className="store-skeleton-bar store-skeleton-bar--short" />
        <div className="store-skeleton-bar store-skeleton-bar--button" />
      </div>
    </div>
  );
}

export default function ProductDetail({ id, seed = null }) {
  const viewer = useViewer();
  useResumePendingAdd(viewer);

  const product = useViewerResource({
    id: `product:${id}`,
    viewer,
    seed: seed?.product,
    load: (get) => get(storeEndpoints.product(id))
  });
  const item = product.phase === "ready" ? product.data : null;
  const categoryId = item?.category?.id ?? null;

  const similar = useViewerResource({
    id: `similar:${categoryId}`,
    viewer,
    seed: seed?.similar,
    enabled: categoryId !== null,
    load: (get) => get(productsPath({ categoryId, limit: 13 }))
  });
  const related = similar.phase === "ready" ? similarProducts(similar.data?.items, id, SIMILAR_LIMIT) : [];

  useScrollRetention(`/products/${id}`, product.phase === "ready" && !product.busy);

  if (product.phase === "error") {
    // 404: the product is gone (or was never published). Anything else is a failed load.
    if (product.error?.status === 404) {
      return (
        <section className="store-state" aria-labelledby="store-product-gone">
          <h1 id="store-product-gone">This product isn&apos;t available</h1>
          <p>It may have been removed, or the link may be wrong.</p>
          <Link className="store-button" href="/products">
            Browse products
          </Link>
        </section>
      );
    }
    return <CatalogueError onRetry={product.retry} />;
  }
  if (!item) return <DetailSkeleton />;

  const available = isAvailable(item);
  return (
    <article className="store-product-page" data-store-product-id={item.id} aria-busy={product.busy ? "true" : undefined}>
      <nav className="store-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href={listingHref({ categoryId: item.category.id })}>{item.category.name}</Link>
          </li>
          <li aria-current="page">{item.name}</li>
        </ol>
      </nav>

      <div className="store-detail">
        <div className="store-detail__image">
          <ProductImage src={item.image_url} />
        </div>

        <div className="store-detail__info">
          <h1>{item.name}</h1>
          <dl className="store-detail__facts">
            <div>
              <dt>Brand</dt>
              <dd>
                <Link className="store-text-link" href={listingHref({ brandId: item.brand.id })}>
                  {item.brand.name}
                </Link>
              </dd>
            </div>
            {item.pack_size ? (
              <div>
                <dt>Net weight</dt>
                <dd>{item.pack_size}</dd>
              </div>
            ) : null}
            {packOf(item).size > 1 ? (
              <div>
                <dt>Sold as</dt>
                <dd>
                  1 {packOf(item).name} = {piecesLabel(packOf(item).size)}
                </dd>
              </div>
            ) : null}
          </dl>

          <PriceBlock product={item} viewer={viewer} />
          <p className={available ? "store-detail__stock" : "store-detail__stock store-detail__stock--out"}>
            {available ? "In stock" : "Out of stock"}
          </p>
          <div className="store-detail__buy">
            <PurchaseControl product={item} viewer={viewer} />
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <ProductShelf
          shelfId={`similar-${item.category.id}`}
          title="Similar products"
          href={listingHref({ categoryId: item.category.id })}
          products={related}
          viewer={viewer}
        />
      ) : null}
    </article>
  );
}
