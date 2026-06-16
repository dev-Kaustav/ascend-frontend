"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/landing/Logo";

const navItems = [
  { label: "How it works", href: "/#system" },
  { label: "For retailers", href: "/#retailers" },
  { label: "For brands", href: "/#brands" },
  { label: "Founders", href: "/#founders" }
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="marketing-nav-wrap">
      <div className="marketing-nav">
        <Logo />
        <nav className="marketing-nav__links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="marketing-nav__actions">
          <Link className="marketing-nav__login" href="/login">
            Login
          </Link>
          <Link className="marketing-button marketing-button--lime marketing-button--small" href="/#contact">
            Stock my store
          </Link>
        </div>
        <button
          type="button"
          className="marketing-menu-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
      <div
        id="mobile-navigation"
        className={`marketing-mobile-nav ${open ? "is-open" : ""}`}
        hidden={!open}
      >
        <nav aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Login
          </Link>
        </nav>
        <Link
          className="marketing-button marketing-button--lime"
          href="/#contact"
          onClick={() => setOpen(false)}
        >
          Stock my store
        </Link>
      </div>
    </header>
  );
}
