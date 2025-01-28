import type { NavigationGroupType } from "@/types";

export const navigationsData: NavigationGroupType[] = [
  {
    title: "Dashboards",
    items: [
      {
        title: "Analytics",
        href: "/dashboards/analytics",
        iconName: "ChartPie",
      },
      {
        title: "CRM",
        href: "/dashboards/crm",
        iconName: "ChartBar",
      },
      {
        title: "eCommerce",
        href: "/dashboards/ecommerce",
        iconName: "ShoppingCart",
      },
    ],
  },
  {
    title: "Pages",
    items: [
      {
        title: "Landing",
        href: "#",
        label: "Soon",
        iconName: "LayoutTemplate",
      },
      {
        title: "Pricing",
        href: "/pages/pricing",
        iconName: "CircleDollarSign",
      },
      {
        title: "Payment",
        href: "/pages/payment",
        iconName: "CreditCard",
      },
      {
        title: "Help Center",
        href: "#",
        label: "Soon",
        iconName: "Headset",
      },
      {
        title: "Not Found 404",
        href: "/pages/not-found-404",
        iconName: "Frown",
      },
      {
        title: "Unauthorized 401",
        href: "/pages/unauthorized-401",
        iconName: "Lock",
      },
      {
        title: "Maintenance",
        href: "/pages/maintenance",
        iconName: "Wrench",
      },
      {
        title: "Coming Soon",
        href: "/pages/coming-soon",
        iconName: "Clock",
      },
      {
        title: "Settings",
        href: "/pages/account/settings",
        iconName: "UserRoundCog",
      },
      {
        title: "Profile",
        href: "/pages/account/profile",
        label: "Soon",
        iconName: "User",
      },
    ],
  },
  {
    title: "Apps",
    items: [
      {
        title: "Email",
        href: "/apps/email",
        iconName: "AtSign",
      },
      {
        title: "Chat",
        href: "/apps/chat",
        iconName: "MessageCircle",
      },
      {
        title: "Calendar",
        href: "/apps/calendar",
        iconName: "Calendar",
      },
      {
        title: "Kanban",
        href: "/apps/kanban",
        iconName: "Grid2x2",
      },
      {
        title: "Todo",
        href: "#",
        label: "Soon",
        iconName: "ListTodo",
      },
    ],
  },
  {
    title: "Authentication",
    items: [
      {
        title: "Forgot Password",
        href: "/auth/forgot-password",
        iconName: "RotateCw",
      },
      {
        title: "New Password",
        href: "/auth/new-password",
        iconName: "RefreshCw",
      },
      {
        title: "Verify Email",
        href: "/auth/verify-email",
        iconName: "MailCheck",
      },
      {
        title: "Register",
        href: "/auth/register",
        iconName: "FilePen",
      },
      {
        title: "Sign In",
        href: "/auth/sign-in",
        iconName: "LogIn",
      },
    ],
  },
  {
    title: "Components",
    items: [
      {
        title: "Forms",
        href: "/forms",
        iconName: "TextCursorInput",
      },
      {
        title: "Tables",
        href: "/tables",
        iconName: "Table",
      },
    ],
  },
];
