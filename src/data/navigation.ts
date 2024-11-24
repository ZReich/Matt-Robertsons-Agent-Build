import {
  ChartPie,
  ChartBar,
  ShoppingCart,
  LayoutTemplate,
  CircleDollarSign,
  Barcode,
  CreditCard,
  Headset,
  AtSign,
  MessageCircle,
  Calendar,
  ListTodo,
  Grid2x2,
} from "lucide-react";

import { Icon } from "@/types";

export interface Nav {
  title: string;
  label?: string;
  icon: Icon;
  href: string;
  children?: Omit<Nav, "icon">[];
}

export interface GroupNav {
  title?: string;
  navs: Nav[];
}

export const groupNavs: GroupNav[] = [
  {
    title: "Dashboards",
    navs: [
      {
        title: "Analytics",
        icon: ChartPie,
        href: "/dashboards/analytics",
      },
      {
        title: "CRM",
        icon: ChartBar,
        href: "/dashboards/crm",
      },
      {
        title: "eCommerce",
        icon: ShoppingCart,
        href: "/dashboards/ecommerce",
      },
    ],
  },
  {
    title: "Pages",
    navs: [
      {
        title: "Landing",
        label: "Soon",
        icon: LayoutTemplate,
        href: "/pages/landing",
      },
      {
        title: "Pricing",
        icon: CircleDollarSign,
        href: "/pages/pricing",
      },
      {
        title: "Payment",
        icon: CreditCard,
        href: "/pages/payment",
      },
      {
        title: "Help Center",
        label: "Soon",
        icon: Headset,
        href: "/pages/help-center",
      },
    ],
  },
  {
    title: "Apps",
    navs: [
      {
        title: "Email",
        icon: AtSign,
        href: "/apps/email",
      },
      {
        title: "Chat",
        icon: MessageCircle,
        href: "/apps/chat",
      },
      {
        title: "Calendar",
        icon: Calendar,
        href: "/apps/calendar",
      },
      {
        title: "Kanban",
        icon: Grid2x2,
        href: "/apps/kanban",
      },
      {
        title: "Todo",
        label: "Soon",
        icon: ListTodo,
        href: "/apps/todo",
      },
    ],
  },
];
