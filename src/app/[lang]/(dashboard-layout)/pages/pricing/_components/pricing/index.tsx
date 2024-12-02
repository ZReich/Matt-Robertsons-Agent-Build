"use client";

import * as React from "react";

import { PricingCard } from "./pricing-card";
import { PricingHeader } from "./pricing-header";

export default function Pricing() {
  const [isAnnual, setIsAnnual] = React.useState(false);

  return (
    <section className="container p-4">
      <PricingHeader isAnnual={isAnnual} setIsAnnual={setIsAnnual} />
      <div className="space-y-8 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
        <PricingCard
          title="Starter"
          description="Great for individuals or small teams. Essential features at an affordable price."
          price={isAnnual ? Math.round((2999 * 12 * 0.85) / 12) : 2999}
          features={[
            "Manage up to five projects simultaneously",
            "Store and access up to 10 GB of data",
            "Get help with standard support channels",
            "Use essential tools and functionalities",
            "Designed for individual use",
          ]}
          isCurrentPlan
        />
        <PricingCard
          title="Company"
          description="Designed for growing teams with enhanced tools and priority support."
          price={isAnnual ? Math.round((9999 * 12 * 0.85) / 12) : 9999}
          features={[
            "Handle up to twenty projects at once",
            "Enjoy 50 GB of storage for your data and files",
            "Receive faster response times for support inquiries",
            "Access additional tools and functionalities",
            "Collaborate with up to ten team members",
            "Tailor the dashboard to fit your team’s needs",
          ]}
          isPopular
        />
        <PricingCard
          title="Enterprise"
          description="for large organizations needing full features and dedicated support."
          price={isAnnual ? Math.round((29999 * 12 * 0.85) / 12) : 29999}
          features={[
            "Manage an unlimited number of projects",
            "Enjoy ample storage with 200 GB for your data",
            "Get personalized assistance from a dedicated account manager",
            "Access top-tier support with priority and extended hours",
            "No limit on the number of users who can access the plan",
            "Benefit from enhanced security measures and compliance",
            "Integrate with other systems and services as needed",
          ]}
        />
      </div>
    </section>
  );
}
