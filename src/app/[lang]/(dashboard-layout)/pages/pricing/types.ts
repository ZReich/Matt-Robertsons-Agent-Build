export interface PricingCardType {
  title: string;
  description: string;
  price: number;
  features: string[];
  isCurrentPlan?: boolean;
  isPopular?: boolean;
}
