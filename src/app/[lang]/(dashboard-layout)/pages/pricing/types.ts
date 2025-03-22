import type { ButtonProps } from "@/components/ui/button"

export interface PricingType {
  title: string
  description: string
  period?: string
  price?: number | null
  features: string[]
  isFeatured?: boolean
  isCurrentPlan?: boolean
  buttonOptions?: ButtonProps
  buttonContent?: React.ReactNode
  content?: React.ReactNode
  href: string
  discountRate?: number | null
}
