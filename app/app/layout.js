import "./app.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "default-no-store";

export default function AppLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="font-sans">{children}</div>
      </ToastProvider>
    </AuthProvider>
  );
}
