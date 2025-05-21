"use client"

import { useParams } from "next/navigation"

import type { LocaleType } from "@/types"

import { Card } from "@/components/ui/card"

export const GOOGLE_MAP_BASE_URL = "https://maps.google.com/maps?"

export function ContactUsMap() {
  const params = useParams()

  const locale = params.lang as LocaleType

  const googleSearchParams = new URLSearchParams({
    hl: locale,
    q: "Toronto+(Shadboard)",
    ie: "UTF8",
    t: "",
    z: "14",
    iwloc: "B",
    output: "embed",
  })
  const url = `${GOOGLE_MAP_BASE_URL}${googleSearchParams.toString()}`

  return (
    <Card className="grow bg-muted overflow-hidden">
      <iframe
        width="100%"
        height="100%"
        className="grayscale"
        title="Shadboard location"
        src={url}
        loading="lazy"
      />
    </Card>
  )
}
