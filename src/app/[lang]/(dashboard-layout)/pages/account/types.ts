import { z } from "zod";

import { userData } from "@/data/user";

import { DeleteAccountSchema } from "./settings/_schemas/delete-account-schema";
import { ProfileInfoSchema } from "./settings/_schemas/profile-info-form";
import { NotificationPreferencesSchema } from "./settings/notifications/_schemas/notifications-preferenes-schema";
import { ChangePlanSchema } from "./settings/plan-and-billing/_schemas/change-plan-schema";
import { PaymentMethodSchema } from "./settings/plan-and-billing/_schemas/payment-method-schema";
import { AccountRecoveryOptionsSchema } from "./settings/_schemas/account-recovery-options-schema";
import { ChangePasswordSchema } from "./settings/_schemas/chnage-password-schema";
import { SecurityPreferencesSchema } from "./settings/_schemas/security-preferences-form";

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

export type DeleteAccountFormType = z.infer<typeof DeleteAccountSchema>;

export type ProfileInfoFormType = z.infer<typeof ProfileInfoSchema>;

export type NotificationPreferencesFormType = z.infer<
  typeof NotificationPreferencesSchema
>;

export type ChangePlanFormType = z.infer<typeof ChangePlanSchema>;

export type PaymentMethodFormType = z.infer<typeof PaymentMethodSchema>;

export type AccountRecoveryOptionsFormType = z.infer<
  typeof AccountRecoveryOptionsSchema
>;

export type ChangePasswordFormType = z.infer<typeof ChangePasswordSchema>;

export type SecurityPreferencesFormType = z.infer<
  typeof SecurityPreferencesSchema
>;
