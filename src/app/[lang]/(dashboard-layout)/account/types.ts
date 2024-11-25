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
  planId: number;
  interval: "monthly" | "yearly";
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "canceled";
  createdAt?: string;
  updatedAt?: string;
}
