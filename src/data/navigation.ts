import type { DynamicIconNameType } from "@/types";

export interface NavType {
  name: string;
  label?: string;
  iconName: DynamicIconNameType;
  href: string;
  children?: Omit<NavType, "icon">[];
}

export interface GroupNavType {
  name: string;
  navs: NavType[];
}

export const groupNavs: GroupNavType[] = [
  {
    name: "Dashboards",
    navs: [
      {
        name: "Analytics",
        iconName: "ChartPie",
        href: "/dashboards/analytics",
      },
      {
        name: "CRM",
        iconName: "ChartBar",
        href: "/dashboards/crm",
      },
      {
        name: "eCommerce",
        iconName: "ShoppingCart",
        href: "/dashboards/ecommerce",
      },
    ],
  },
  {
    name: "Pages",
    navs: [
      {
        name: "Landing",
        label: "Soon",
        iconName: "LayoutTemplate",
        href: '#',
      },
      {
        name: "Pricing",
        iconName: "CircleDollarSign",
        href: "/pages/pricing",
      },
      {
        name: "Payment",
        iconName: "CreditCard",
        href: "/pages/payment",
      },
      {
        name: "Help Center",
        label: "Soon",
        iconName: "Headset",
        href: '#',
      },
    ],
  },
  {
    name: "Apps",
    navs: [
      {
        name: "Email",
        iconName: "AtSign",
        href: "/apps/email",
      },
      {
        name: "Chat",
        iconName: "MessageCircle",
        href: "/apps/chat",
      },
      {
        name: "Calendar",
        iconName: "Calendar",
        href: "/apps/calendar",
      },
      {
        name: "Kanban",
        iconName: "Grid2x2",
        href: "/apps/kanban",
      },
      {
        name: "Todo",
        label: "Soon",
        iconName: "ListTodo",
        href: '#',
      },
    ],
  },
];
