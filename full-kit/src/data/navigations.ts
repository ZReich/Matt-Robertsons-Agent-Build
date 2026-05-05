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
      // The People surface unifies Contacts / Leads / Clients views (they're
      // all the same Contact rows with different filters). The detail page
      // is shared, so cross-linking between filters is one click.
      {
        title: "Contacts",
        href: "/pages/contacts",
        iconName: "Users",
      },
      {
        title: "Leads",
        href: "/pages/leads",
        iconName: "Target",
      },
      {
        title: "Clients",
        href: "/pages/clients",
        iconName: "Building2",
      },
      // Contact Candidates kept as its own entry — Matt liked this surface
      // specifically (it's the approval-gate UX he praised on the call).
      {
        title: "Contact Candidates",
        href: "/pages/contact-candidates",
        iconName: "ShieldCheck",
      },
    ],
  },
  {
    // Pipeline groups the listing-side surfaces. Deals + Properties are flip
    // sides of the same conversation: a Property is the asset, a Deal is the
    // transaction-in-progress on it. They cross-link via Property.deals[].
    title: "Pipeline",
    items: [
      {
        title: "Deals",
        href: "/pages/deals",
        iconName: "Handshake",
      },
      {
        title: "Properties",
        href: "/pages/properties",
        iconName: "Building",
      },
    ],
  },
  {
    // Activity is work and signals over time. Pending Replies belongs here:
    // it's an AI work-item queue, conceptually a sibling of Todos, NOT a
    // people entity. Matt's "shouldn't have to switch tabs" instinct is
    // satisfied by drilldown drawers within each surface (next session).
    title: "Activity",
    items: [
      {
        title: "Pending Replies",
        href: "/pages/pending-replies",
        iconName: "Reply",
      },
      {
        title: "Transcripts",
        href: "/pages/transcripts",
        iconName: "Mic",
      },
      {
        title: "Todos",
        href: "/apps/todos",
        iconName: "ListTodo",
      },
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
    ],
  },
  {
    title: "Resources",
    items: [
      {
        title: "Templates",
        href: "/pages/templates",
        iconName: "FileText",
      },
      {
        title: "Files",
        href: "/apps/files",
        iconName: "FolderOpen",
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
