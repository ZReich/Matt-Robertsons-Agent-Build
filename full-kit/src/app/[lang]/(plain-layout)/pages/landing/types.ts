import type { Button } from "@/components/ui/button"
import type { IconType } from "@/types"
import type { ComponentProps, ReactNode } from "react"
import type { z } from "zod"
import type { ContactUsSchema } from "./_schemas/contact-us-schema"

export type ContactUsType = z.infer<typeof ContactUsSchema>

export interface LandingNavigationType {
  title: string
  href: string
}

export interface CoreFeatureType {
  title: string
  description: string
  icon: IconType
}

export interface WhatPeopleSayType {
  name: string
  role: string
  company: string
  quote: string
  avatar: string
  rating: number
}

export interface ToolAndTechnologieType {
  title: string
  href: string
  icon: IconType
}

export interface FaqType {
  question: string
  answer: ReactNode
}

export interface PricingPlansType {
  title: string
  description: string
  period?: string
  price?: number | null
  features: string[]
  isFeatured?: boolean
  isCurrentPlan?: boolean
  buttonOptions?: ComponentProps<typeof Button>
  buttonContent?: ReactNode
  content?: ReactNode
  href: string
  discountRate?: number | null
}
