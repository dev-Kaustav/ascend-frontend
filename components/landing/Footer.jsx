import Link from "next/link";
import Logo from "@/components/landing/Logo";

export default function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="marketing-footer__top">
          <div>
            <Logo />
            <p>India&apos;s four-hour FMCG restocking network.</p>
          </div>
          <div className="marketing-footer__links">
            <a href="mailto:kaustav@ascendfoods.in">kaustav@ascendfoods.in</a>
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/login">Team login</Link>
          </div>
        </div>
        <div className="marketing-footer__bottom">
          <span>Ascend Foods Pvt Ltd · Gurugram, India</span>
          <span>&copy; {new Date().getFullYear()} Ascend Foods</span>
        </div>
      </div>
    </footer>
  );
}
