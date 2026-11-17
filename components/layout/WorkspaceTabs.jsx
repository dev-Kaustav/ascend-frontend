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
  // A hidden tab is left out of the tab bar but still opens from its ?tab= link, so retiring a
  // little-used section breaks no bookmark.
  const visibleTabs = useMemo(() => allowedTabs.filter((tab) => !tab.hidden), [allowedTabs]);

  const requestedTab = searchParams.get("tab");
  const activeTab = useMemo(() => {
    if (!allowedTabs.length) return null;
    return allowedTabs.find((tab) => tab.key === requestedTab) || visibleTabs[0] || allowedTabs[0];
  }, [allowedTabs, visibleTabs, requestedTab]);

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
      {/* Desktop (lg+): the page title on the ground and underline tabs on one full-width rule.
          Below lg the earlier card and pill tabs stay, for the field apps. */}
      <section className="field-workspace-heading max-lg:rounded-[1.75rem] max-lg:border max-lg:border-slate-200/70 max-lg:bg-white max-lg:px-7 max-lg:py-6 max-lg:shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col gap-5 lg:gap-4">
          <div>
            <h1 className="text-[2rem] font-bold tracking-[-0.03em] text-slate-900 lg:text-2xl lg:font-semibold lg:tracking-[-0.01em] lg:text-ink">{title}</h1>
            <p className="mt-2 text-sm text-slate-600 lg:mt-1 lg:text-muted">{subtitle}</p>
          </div>
          <div className="field-workspace-tabs flex flex-wrap gap-2.5 lg:gap-6 lg:border-b lg:border-line" role="tablist">
            {visibleTabs.map((tab) => {
              const isActive = activeTab.key === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-pressed={isActive}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", tab.key);
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                  className={`cursor-pointer text-sm font-semibold transition-colors max-lg:rounded-full max-lg:px-5 max-lg:py-2.5 lg:-mb-px lg:border-b-2 lg:pb-2.5 lg:font-medium ${
                    isActive
                      ? "max-lg:bg-[#1a1b2e] max-lg:text-white max-lg:shadow-lg max-lg:shadow-[#1a1b2e]/20 lg:border-ink lg:text-ink"
                      : "max-lg:bg-slate-100 max-lg:text-slate-700 max-lg:hover:bg-slate-200 lg:border-transparent lg:text-muted lg:hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        {activeTab.description ? <p className="field-workspace-description mt-4 text-sm text-slate-500 lg:hidden">{activeTab.description}</p> : null}
      </section>

      <div key={activeTab.key}>{activeTab.render()}</div>
    </div>
  );
}
