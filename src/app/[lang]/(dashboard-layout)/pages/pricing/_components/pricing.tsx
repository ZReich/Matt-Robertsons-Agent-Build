"use client"

import * as React from "react"

import type { PricingCardType } from "../types"

import PricingCardList from "./pricing-card-list"
import { PricingHeader } from "./pricing-header"

export function Pricing({ data }: { data: PricingCardType[] }) {
  const [isAnnual, setIsAnnual] = React.useState(false)

  return (
    <>
      <PricingHeader isAnnual={isAnnual} setIsAnnual={setIsAnnual} />
      <PricingCardList isAnnual={isAnnual} data={data} />
    </>
  )
}
