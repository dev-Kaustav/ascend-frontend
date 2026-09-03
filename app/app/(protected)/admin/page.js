"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import UsersAdminPanel from "@/components/workspaces/UsersAdminPanel";
import QuickCreateWorkspacePanel from "@/components/workspaces/QuickCreateWorkspacePanel";
import CompanyProfilePanel from "@/components/workspaces/CompanyProfilePanel";

export default function AdminWorkspacePage() {
  const tabs = [
    {
      key: "users",
      label: "Users",
      description: "Users and groups remain the primary admin control surface.",
      roles: ["ADMIN"],
      render: () => (
        <UsersAdminPanel
          showHeader={false}
          showGroupsSection={true}
          showUsersSection={true}
        />
      )
    },
    {
      key: "company-profile",
      label: "Company Profile",
      description: "Supplier details stamped onto every invoice at dispatch.",
      roles: ["ADMIN"],
      render: () => <CompanyProfilePanel />
    },
    {
      key: "quick-create",
      label: "Quick Create",
      description: "Admin utility actions collected into one focused creation panel.",
      roles: ["ADMIN"],
      render: () => <QuickCreateWorkspacePanel />
    }
  ];

  return (
    <WorkspaceTabs
      title="Admin"
      subtitle="Access control and admin utilities grouped into one workspace."
      tabs={tabs}
    />
  );
}
