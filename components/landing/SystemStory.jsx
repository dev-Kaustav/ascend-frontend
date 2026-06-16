"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import ConveyorEnvironment from "@/components/landing/ConveyorEnvironment";

const metrics = [
  ["3,000+", "active stores"],
  ["100+", "curated SKUs"],
  ["4 hours", "delivery window"],
  ["2", "dark stores live"]
];

const steps = [
  {
    number: "01",
    label: "Detect",
    title: "Demand becomes visible before the shelf runs dry.",
    body: "Store-level movement signals which fast-movers need attention, replacing guesswork with a timely restock decision."
  },
  {
    number: "02",
    label: "Route",
    title: "The right basket reaches the retailer.",
    body: "A focused catalogue, transparent pricing, and personalized quantities turn replenishment into one clear order."
  },
  {
    number: "03",
    label: "Fulfil",
    title: "Nearby inventory moves immediately.",
    body: "The closest Ascend dark store receives the order, picks the case, verifies it, and prepares dispatch."
  },
  {
    number: "04",
    label: "Restock",
    title: "The shelf is replenished inside four hours.",
    body: "Dense-cluster fulfillment closes the distance between demand appearing and inventory returning to the store."
  }
];

export default function SystemStory() {
  const stageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start start", "end end"]
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.17, 0.25], [1, 1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.24], [0, -90]);

  return (
    <section ref={stageRef} className="system-story" id="system">
      <div className="system-story__machine">
        <ConveyorEnvironment stageRef={stageRef} />
        <div className="system-story__shade" />
      </div>

      <motion.div
        className="marketing-hero"
        style={reduceMotion ? undefined : { opacity: heroOpacity, y: heroY }}
      >
        <div className="marketing-container marketing-hero__inner">
          <div className="marketing-hero__copy">
            <p className="marketing-kicker">
              <span /> FMCG replenishment infrastructure
            </p>
            <h1>
              Restock any shelf in <em>four hours.</em>
            </h1>
            <p className="marketing-hero__lead">
              Ascend connects store-level demand to inventory already positioned
              nearby, so fast-moving products return before the next sale is lost.
            </p>
            <div className="marketing-hero__actions">
              <Link className="marketing-button marketing-button--lime" href="/#contact">
                Stock my store
                <span aria-hidden="true">↗</span>
              </Link>
              <Link className="marketing-text-link" href="/#retailers">
                See what retailers get
                <span aria-hidden="true">↓</span>
              </Link>
            </div>
          </div>
          <div className="marketing-hero__machine-note" aria-hidden="true">
            <span>System 01</span>
            <i />
            <span>Demand to shelf</span>
          </div>
        </div>
        <div className="marketing-scroll-cue" aria-hidden="true">
          <span>Scroll to follow the system</span>
          <i />
        </div>
      </motion.div>

      <div className="marketing-proof">
        <dl className="marketing-container marketing-proof__grid">
          {metrics.map(([value, label]) => (
            <div key={label}>
              <dd>{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="system-sequence">
        <div className="marketing-container system-sequence__intro">
          <p className="marketing-kicker">
            <span /> Signal to shelf
          </p>
          <h2>One connected operating loop.</h2>
          <p>
            Ascend combines the demand layer and the physical network. Each step
            exists to shorten the time between a product running low and returning
            to the counter.
          </p>
        </div>

        <ol className="marketing-container system-steps">
          {steps.map((step) => (
            <li key={step.number} className="system-step">
              <article>
                <div className="system-step__meta">
                  <span>{step.number}</span>
                  <span>{step.label}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
