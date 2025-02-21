import { Sparkles } from "lucide-react";

import type { PricingCardType } from "../types";

export const pricingPlansData: PricingCardType[] = [
  {
    title: "Regular License",
    description:
      "For personal or client use in a single project where end users do not pay for access.",
    price: 9,
    features: [
      "Support for 6 months",
      "Quality checked by Envato",
      "Lifetime Free Updates",
    ],
    isFeatured: false,
    buttonContent: "Purchase Shadboard",
    href: "/",
  },
  {
    title: "Extended License",
    description:
      "For personal or client use in a single project that allows monetization or paid user access.",
    price: 300,
    features: [
      "Support for 6 months",
      "Quality checked by Envato",
      "Lifetime Free Updates",
    ],
    isFeatured: true,
    buttonContent: "Purchase Shadboard",
    href: "/",
  },
  {
    title: "Custom License",
    description:
      "Need a custom license for your business model? Contact us to discuss your requirements.",
    price: null,
    features: [],
    isFeatured: false,
    content: <Sparkles className="h-20 w-20 my-12 mx-auto" />,
    buttonContent: "Contact Us",
    buttonOptions: {
      variant: "secondary",
    },
    href: "/contact-us",
  },
];
