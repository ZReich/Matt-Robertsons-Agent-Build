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
        title: "CRM",
        icon: ChartBar,
        href: "/dashboards/crm",
      },
      {
        title: "Analytics",
        icon: ChartPie,
        href: "/dashboards/analytics",
      },
      {
        title: "eCommerce",
        label: "2 New",
        icon: ShoppingCart,
        href: "/dashboards/ecommerce",
        children: [
          {
            title: "Products",
            href: "/dashboards/ecommerce/products",
          },
          {
            title: "Orders",
            href: "/dashboards/ecommerce/orders",
          },
        ],
      },
    ],
  },
  {
    title: "Pages",
    navs: [
      {
        title: "Landing",
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
        title: "Checkout",
        icon: Barcode,
        href: "/pages/checkout",
      },
      {
        title: "Help Center",
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
        title: "Todo",
        icon: ListTodo,
        href: "/apps/todo",
      },
    ],
  },
];
