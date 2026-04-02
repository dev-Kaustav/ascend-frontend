"use client";

import RemovedRouteNotice from "@/components/layout/RemovedRouteNotice";

export default function RemovedUsersPage() {
  return (
    <RemovedRouteNotice
      title="Users moved into Admin"
      description="User management is now part of the Admin workspace."
      href="/app/admin?tab=users"
      ctaLabel="Open Admin"
    />
  );
}
