import type { IconType } from "@/types";

export interface LandingNavigationType {
  title: string;
  href: string;
}

export interface ToolAndTechnologieType {
  title: string;
  href: string;
  icon: IconType;
}

export interface CoreFeatureType {
  title: string;
  description: string;
  icon: IconType;
}

export interface FaqType {
  question: string;
  answer: React.ReactNode;
}