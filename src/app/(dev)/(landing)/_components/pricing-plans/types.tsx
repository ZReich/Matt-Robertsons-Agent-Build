import type { ButtonProps } from "../ui/button";

export interface PricingCardType {
  title: string;
  description: string;
  price: number | null;
  features: string[];
  featured?: boolean;
  buttonOptions?: ButtonProps;
  buttonContent?: React.ReactNode;
  content?: React.ReactNode;
  href: string;
}
