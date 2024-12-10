import { userData } from "@/data/user";

import type { DynamicIconNameType } from "@/types";

export type UserType = typeof userData;

export interface PlanType {
  id: number;
  name: string;
  price: number;
  features: string[];
}

export interface SubscriptionType {
  id: number;
  planId: number;
  interval: "monthly" | "yearly";
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "canceled";
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrentPlanType {
  plan: {
    name: string;
    price: string;
    description: string;
  };
  stats: {
    activeProjects: {
      value: number;
      max: number;
      progress: number;
    };
    teamMembers: {
      value: number;
      max: number;
      progress: number;
    };
    storageUsed: {
      value: number;
      max: number;
      progress: number;
    };
  };
  activityThisMonth: Array<{
    iconName: DynamicIconNameType;
    count: number;
    label: string;
  }>;
  billingInfo: {
    nextBillingDate: Date;
    amountDue: number;
  };
}
