import type { ButtonProps } from "@/components/ui/button"
import type { IconType } from "@/types"

export interface HomeNavigationType {
  title: string
  href: string
}

export interface ToolAndTechnologieType {
  title: string
  href: string
  icon: IconType
}

export interface CoreFeatureType {
  title: string
  description: string
  icon: IconType
}

export interface FaqType {
  question: string
  answer: React.ReactNode
}

export interface PricingCardType {
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
