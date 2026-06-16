"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const brands = ["myupchaar", "Crax", "Jabsons", "Lahori Jeera"];
const repeatedBrands = [...brands, ...brands, ...brands];

export default function BrandStrip() {
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  const x = useTransform(scrollYProgress, [0, 1], ["7%", "-21%"]);

  return (
    <section ref={sectionRef} className="brand-strip" aria-labelledby="brand-strip-title">
      <div className="brand-strip__header marketing-container">
        <p id="brand-strip-title">Brands currently served through Ascend</p>
      </div>
      <div className="brand-strip__viewport" tabIndex={shouldReduceMotion ? 0 : undefined}>
        <motion.ul
          aria-label="Served brands"
          className="brand-strip__track"
          style={{ x: shouldReduceMotion ? 0 : x }}
        >
          {repeatedBrands.map((brand, index) => (
            <li
              aria-hidden={index >= brands.length}
              className="brand-wordmark"
              data-brand={brand}
              key={`${brand}-${index}`}
            >
              {brand}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
