import "./app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "default-no-store";

export default function AppLayout({ children }) {
  return <div className="font-sans">{children}</div>;
}
