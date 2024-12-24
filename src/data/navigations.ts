import type { NavigationGroupType } from "@/types";

export const navigations: NavigationGroupType[] = [
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
];
