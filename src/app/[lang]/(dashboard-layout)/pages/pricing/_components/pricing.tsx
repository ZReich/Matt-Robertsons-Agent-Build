"use client"

import { useState } from "react"

import type { PricingType } from "../types"

import { PricingHeader } from "./pricing-header"
import PricingCardList from "./pricing-list"

export function Pricing({ data }: { data: PricingType[] }) {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <>
      <PricingHeader isAnnual={isAnnual} setIsAnnual={setIsAnnual} />
      <PricingCardList isAnnual={isAnnual} data={data} />
    </>
  )
}
