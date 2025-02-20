"use client";

import * as React from "react";

import type { PricingCardType } from "./types";

import { PricingCardList } from "./pricing-card-list";
import { Sparkles } from "lucide-react";

const pricingPlansData: PricingCardType[] = [
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
    featured: false,
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
    featured: true,
    buttonContent: "Purchase Shadboard",
    href: "/",
  },
  {
    title: "Custom License",
    description:
      "Need a custom license for your business model? Contact us to discuss your requirements.",
    price: null,
    features: [],
    featured: false,
    content: <Sparkles className="h-20 w-20 my-12 mx-auto" />,
    buttonContent: "Contact Us",
    buttonOptions: {
      variant: "secondary",
    },
    href: "/contact-us",
  },
];

export function PricingPlans() {
  return (
    <section id="pricing-plans" className="container grid gap-6 p-4 py-16">
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Pricing Plans</h1>
        <p className="max-w-prose mx-auto">
          Shadboard offers exceptional value, saving you thousands in
          development costs. With every update, it grows more powerful, making
          it a smart investment for your projects.
        </p>
      </div>
      <PricingCardList data={pricingPlansData} />
    </section>
  );
}
