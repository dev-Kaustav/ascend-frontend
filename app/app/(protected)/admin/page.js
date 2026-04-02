"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import UsersAdminPanel from "@/components/workspaces/UsersAdminPanel";
import QuickCreateWorkspacePanel from "@/components/workspaces/QuickCreateWorkspacePanel";

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
          showAccessRulesSection={false}
        />
      )
    },
    {
      key: "access-rules",
      label: "Access Rules",
      description: "Route-level access control consolidated into the admin workspace.",
      roles: ["ADMIN"],
      render: () => (
        <UsersAdminPanel
          showHeader={false}
          showGroupsSection={false}
          showUsersSection={false}
          showAccessRulesSection={true}
        />
      )
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
