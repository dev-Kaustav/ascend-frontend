"use client";

import {  } from "react";

import ManualFinder from "@/components/outlet-finder/ManualFinder";
import DriverJobs from "@/components/outlet-finder/DriverJobs";
import { useAuth } from "@/components/auth/AuthProvider";

export default function OutletFinderPage() {
  const { role } = useAuth();

  if (role === "DRIVER") {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-xl font-semibold text-slate-900">My routes & jobs</h1>
          <p className="mb-4 mt-1 text-sm text-slate-500">Accept a job and start your outlet route.</p>
          <DriverJobs />
        </section>
        <section className="border-t border-slate-200 pt-5">
          <h2 className="text-lg font-semibold text-slate-900">Find an outlet</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Enter outlet IDs to plan an ad-hoc route.</p>
          <ManualFinder />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Outlet Finder</h1>
        <p className="text-sm text-slate-500 mt-0.5">Plan a route and assign it to a driver</p>
      </div>
      <ManualFinder assignable />
    </div>
  );
}
