import { userData } from "./_data/user";

export type UserType = typeof userData;

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
