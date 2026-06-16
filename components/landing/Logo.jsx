import Link from "next/link";

export default function Logo({ dark = false, onClick }) {
  return (
    <Link
      href="/#main"
      onClick={onClick}
      className={`marketing-logo ${dark ? "marketing-logo--dark" : ""}`}
      aria-label="Ascend Foods home"
    >
      <svg viewBox="0 0 34 34" aria-hidden="true">
        <path d="M5 28 16.8 5 29 28h-7.3l-4.9-10.2L12 28H5Z" fill="currentColor" />
        <path d="m10.5 22.2 6.3-4.4 6.6 4.4" fill="none" stroke="var(--m-lime)" strokeWidth="2.4" />
      </svg>
      <span>ASCEND</span>
    </Link>
  );
}
