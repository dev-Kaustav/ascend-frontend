"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

function isTabAllowed(tab, role) {
  return !tab.roles?.length || tab.roles.includes(role);
}

export default function WorkspaceTabs({ title, subtitle, tabs = [] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const allowedTabs = useMemo(() => tabs.filter((tab) => isTabAllowed(tab, role)), [tabs, role]);

  const requestedTab = searchParams.get("tab");
  const activeTab = useMemo(() => {
    if (!allowedTabs.length) return null;
    return allowedTabs.find((tab) => tab.key === requestedTab) || allowedTabs[0];
  }, [allowedTabs, requestedTab]);

  useEffect(() => {
    if (!activeTab) return;
    if (requestedTab === activeTab.key) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab.key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, requestedTab, router, searchParams]);

  if (!activeTab) {
    return (
      <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
        No accessible sections are available in this workspace.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="field-workspace-heading rounded-[1.75rem] border border-slate-200/70 bg-white px-7 py-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold tracking-[-0.03em] text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          </div>
          <div className="field-workspace-tabs flex flex-wrap gap-2.5">
            {allowedTabs.map((tab) => {
              const isActive = activeTab.key === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", tab.key);
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                  className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-[#1a1b2e] text-white shadow-lg shadow-[#1a1b2e]/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        {activeTab.description ? <p className="field-workspace-description mt-4 text-sm text-slate-500">{activeTab.description}</p> : null}
      </section>

      <div key={activeTab.key}>{activeTab.render()}</div>
    </div>
  );
}
