import DemoShell from "./_components/Shell";
import "./_components/demo.css";

export const metadata = {
  title: "AI Replenishment Demo",
  description: "Ascend Foods — AI replenishment command centre (investor demo).",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }) {
  return <DemoShell>{children}</DemoShell>;
}
