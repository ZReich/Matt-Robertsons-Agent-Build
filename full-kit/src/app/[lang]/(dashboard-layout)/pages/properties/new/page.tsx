import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import type { Metadata } from "next"

import { Button } from "@/components/ui/button"

import { PropertyForm } from "../_components/property-form"

export const metadata: Metadata = {
  title: "New property",
}

export default async function NewPropertyPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <section className="container grid max-w-3xl gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${lang}/pages/properties`}>
            <ArrowLeft className="mr-1 size-4" /> Properties
          </Link>
        </Button>
      </div>
      <header>
        <h1 className="text-xl font-semibold">New property</h1>
        <p className="text-sm text-muted-foreground">
          Add a listing to the catalog. Address is the only required field.
        </p>
      </header>
      <PropertyForm lang={lang} />
    </section>
  )
}
