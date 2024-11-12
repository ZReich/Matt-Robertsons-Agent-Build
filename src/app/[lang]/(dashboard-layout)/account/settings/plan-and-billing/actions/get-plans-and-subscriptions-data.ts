import { plansData } from "../../../_data/plans";
import { subscriptionsData } from "../../../_data/subscriptions";

import type { Plan, Subscription } from "../../../types";

export async function getPlansAndSubscriptionsData(): Promise<{
  plans: Plan[];
  subscriptions: Subscription[];
}> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ plans: plansData, subscriptions: subscriptionsData });
    }, 1000);
  });
}
