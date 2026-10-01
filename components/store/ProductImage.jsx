"use client";

import { Package } from "lucide-react";
import { useState } from "react";

// Hotlinked catalogue image in a square tile whose size comes from .store-product-image, so
// layout is reserved before the image loads. A missing, non-HTTPS or failing URL keeps the
// product visible with a neutral package icon rather than a broken-image glyph.
export default function ProductImage({ src, lazy = false }) {
  const [failed, setFailed] = useState(false);
  const usable = typeof src === "string" && src.startsWith("https://") && !failed;

  return (
    <div className="store-product-image">
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote host is not whitelisted for next/image
        <img
          src={src}
          alt=""
          width={160}
          height={160}
          loading={lazy ? "lazy" : "eager"}
          onError={() => setFailed(true)}
        />
      ) : (
        <Package size={40} strokeWidth={1.5} aria-hidden="true" color="#5B5B62" data-store-image-fallback="" />
      )}
    </div>
  );
}
