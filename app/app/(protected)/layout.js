"use client";

import AccessLayout from "@/components/layout/AccessLayout";

export default function ProtectedLayout({ children }) {
  return <AccessLayout>{children}</AccessLayout>;
}
