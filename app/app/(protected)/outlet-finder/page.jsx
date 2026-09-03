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
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Outlet Finder</h1>
          <p className="text-sm text-slate-500 mt-0.5">Search by outlet IDs to plan an ad-hoc route</p>
        </div>
        <ManualFinder />

        <div className="pt-2 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mt-4">My Jobs</h2>
          <p className="text-sm text-slate-500 mt-0.5 mb-3">Accept a job, then deliver each outlet</p>
          <DriverJobs />
        </div>
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
