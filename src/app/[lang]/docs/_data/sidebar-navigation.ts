import { NavigationGroupType } from "@/types";

export const sidebarNavigationData: NavigationGroupType[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Introduction",
        href: "/docs/overview/introduction",
        iconName: "User",
      },
      {
        title: "Kits",
        href: "/docs/overview/kits",
        iconName: "User",
      },
      {
        title: "Installation",
        href: "/docs/overview/installation",
        iconName: "User",
      },
      {
        title: "Deployment",
        href: "/docs/overview/deployment",
        iconName: "User",
      },
    ],
  },
  {
    title: "Development",
    items: [
      {
        title: "Authentication",
        href: "/docs/development/authentication",
        iconName: "User",
      },
      {
        title: "I18n",
        href: "/docs/development/i18n",
        iconName: "User",
      },
      {
        title: "Navigation",
        href: "/docs/development/navigation",
        iconName: "User",
      },

      {
        title: "Theme Color",
        href: "/docs/development/theme-color",
        iconName: "User",
      },
    ],
  },
  {
    title: "Others",
    items: [
      {
        title: "Credits",
        href: "/docs/others/credits",
        iconName: "User",
      },
    ],
  },
];
