import type { Metadata } from "next";

import { PaymentMethodForm } from "./_components/payment-method-form";
import { CurrentPlan } from "./_components/current-plan";
import { ChangePlan } from "./_components/change-plan";
import { SavedCards } from "./_components/saved-cards";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Plan and Billing Settings",
};

export default async function PlanAndBillingPage() {
  return (
    <div className="grid gap-4">
      <CurrentPlan />
      <ChangePlan />
      <PaymentMethodForm />
      <SavedCards />
    </div>
  );
}
