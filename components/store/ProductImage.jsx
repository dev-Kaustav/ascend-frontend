"use client";

import { Package } from "lucide-react";
import { useState } from "react";

// Hotlinked catalogue image. A missing, non-HTTPS or failing URL keeps the product visible
// with a neutral package icon rather than a broken-image glyph.
export default function ProductImage({ src, size = 160 }) {
  const [failed, setFailed] = useState(false);
  const usable = typeof src === "string" && src.startsWith("https://") && !failed;

  return (
    <div
      className="store-product-image"
      style={{ width: size, height: size, display: "grid", placeItems: "center", background: "#F7F7F5" }}
    >
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote host is not whitelisted for next/image
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%" }}
        />
      ) : (
        <Package size={40} strokeWidth={1.5} aria-hidden="true" color="#5B5B62" />
      )}
    </div>
  );
}
