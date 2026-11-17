// How a SKU is shown wherever it is read rather than edited: its cover photo, its name, and its
// code (what stock sheets print) as a quiet second line. Name, photo and code are maintained in
// the Catalog only. The stored URL is only ever an img src (see CatalogPanel's Thumbnail).
export default function SkuCell({ sku, name, code, imageUrl, sub, size = "md" }) {
  const label = name || sku?.name || (sku?.id ? `SKU ${sku.id}` : "Unknown SKU");
  const skuCode = code ?? sku?.code;
  const image = imageUrl ?? sku?.image_url;
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const secondLine = [skuCode, sub].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className={`${box} shrink-0 rounded-md border border-line bg-white object-cover`} />
      ) : (
        <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center rounded-md bg-raised text-xs font-medium text-muted`}>
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-ink" title={label}>{label}</span>
        {secondLine ? <span className="block truncate text-xs text-muted">{secondLine}</span> : null}
      </span>
    </span>
  );
}
