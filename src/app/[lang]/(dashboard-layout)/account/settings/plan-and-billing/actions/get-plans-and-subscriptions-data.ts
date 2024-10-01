export interface Plan {
  id: number;
  name: string;
  price: number;
  features: string[];
}

export interface Subscription {
  id: number;
  plan_id: number;
  interval: "monthly" | "yearly";
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "canceled";
  created_at?: string;
  updated_at?: string;
}

const plans: Plan[] = [
  {
    id: 1,
    name: "Starter",
    price: 9.99,
    features: [
      "Up to 5 active projects",
      "Up to 10 team members",
      "20 GB storage",
      "Basic project analytics",
      "Email support",
    ],
  },
  {
    id: 2,
    name: "Business",
    price: 19.99,
    features: [
      "Up to 20 active projects",
      "Up to 25 team members",
      "100 GB storage",
      "Advanced project analytics",
      "Custom workflows",
      "Priority support",
      "API access",
    ],
  },
  {
    id: 3,
    name: "Enterprise",
    price: 199.99,
    features: [
      "Unlimited active projects",
      "Unlimited team members",
      "Unlimited storage",
      "Advanced project analytics",
      "Custom workflows",
      "Dedicated support",
      "API access",
      "Custom integrations",
      "On-premise deployment option",
    ],
  },
];

const subscriptions: Subscription[] = [
  {
    id: 1,
    plan_id: 1,
    interval: "monthly",
    start_date: "2024-09-01T10:30:00.000Z",
    end_date: "2024-10-01T10:30:00.000Z",
    status: "active",
  },
  {
    id: 2,
    plan_id: 2,
    interval: "monthly",
    start_date: "2024-09-02T11:00:00.000Z",
    end_date: "2024-10-02T11:00:00.000Z",
    status: "active",
    created_at: "2024-09-02T11:00:00.000Z",
    updated_at: "2024-09-02T11:00:00.000Z",
  },
  {
    id: 3,
    plan_id: 3,
    interval: "monthly",
    start_date: "2023-09-01T11:30:00.000Z",
    end_date: "2024-09-01T11:30:00.000Z",
    status: "expired",
    created_at: "2023-09-01T11:30:00.000Z",
    updated_at: "2024-09-01T11:30:00.000Z",
  },
];

export const getPlansAndSubscriptionsData = async (): Promise<{
  plans: Plan[];
  subscriptions: Subscription[];
}> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ plans, subscriptions });
    }, 1000);
  });
};
