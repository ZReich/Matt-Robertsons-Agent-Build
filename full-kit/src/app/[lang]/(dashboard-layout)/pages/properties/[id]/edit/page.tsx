import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import type { Metadata } from "next"

import { db } from "@/lib/prisma"

import { Button } from "@/components/ui/button"

import { PropertyForm } from "../../_components/property-form"

export const metadata: Metadata = {
  title: "Edit property",
}

export const dynamic = "force-dynamic"

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>
}) {
  const { id, lang } = await params
  const property = await db.property.findUnique({ where: { id } })
  if (!property) notFound()

  return (
    <section className="container grid max-w-3xl gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${lang}/pages/properties/${id}`}>
            <ArrowLeft className="mr-1 size-4" /> Property
          </Link>
        </Button>
      </div>
      <header>
        <h1 className="text-xl font-semibold">Edit property</h1>
        <p className="text-sm text-muted-foreground">{property.address}</p>
      </header>
      <PropertyForm
        lang={lang}
        initial={{
          id: property.id,
          name: property.name,
          address: property.address,
          unit: property.unit,
          city: property.city,
          state: property.state,
          zip: property.zip,
          propertyType: property.propertyType,
          status: property.status,
          squareFeet: property.squareFeet,
          occupiedSquareFeet: property.occupiedSquareFeet,
          listPrice: property.listPrice ? Number(property.listPrice) : null,
          capRate: property.capRate ? Number(property.capRate) : null,
          listingUrl: property.listingUrl,
          flyerUrl: property.flyerUrl,
          description: property.description,
        }}
      />
    </section>
  )
}
