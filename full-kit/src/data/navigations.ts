import type { NavigationType } from "@/types"

export const navigationsData: NavigationType[] = [
  {
    title: "Main",
    items: [
      {
        title: "Home",
        href: "/dashboards/home",
        iconName: "LayoutDashboard",
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        title: "Clients",
        href: "/pages/clients",
        iconName: "Building2",
      },
      {
        title: "Leads",
        href: "/pages/leads",
        iconName: "Target",
      },
      {
        title: "Contact Candidates",
        href: "/pages/contact-candidates",
        iconName: "ShieldCheck",
      },
      {
        title: "Deals",
        href: "/pages/deals",
        iconName: "Handshake",
      },
      {
        title: "Contacts",
        href: "/pages/contacts",
        iconName: "Users",
      },
    ],
  },
  {
    title: "Activity",
    items: [
      {
        title: "Communications",
        href: "/apps/communications",
        iconName: "MessageSquare",
      },
      {
        title: "Calendar",
        href: "/apps/calendar",
        iconName: "Calendar",
      },
      {
        title: "Todos",
        href: "/apps/todos",
        iconName: "ListTodo",
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        title: "Files",
        href: "/apps/files",
        iconName: "FolderOpen",
      },
      {
        title: "Templates",
        href: "/pages/templates",
        iconName: "FileText",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Agent",
        href: "/pages/agent",
        iconName: "Bot",
      },
      {
        title: "Settings",
        href: "/pages/account/settings",
        iconName: "Settings",
      },
    ],
  },
]
