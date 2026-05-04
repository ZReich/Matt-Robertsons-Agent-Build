import Link from "next/link"
import { ArrowLeft, FileUp } from "lucide-react"

import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { PropertyImportForm } from "./_components/property-import-form"

export const metadata: Metadata = {
  title: "Import properties",
}

export default async function ImportPropertiesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <section className="container grid max-w-4xl gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${lang}/pages/properties`}>
            <ArrowLeft className="mr-1 size-4" /> Properties
          </Link>
        </Button>
      </div>
      <header className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <FileUp className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Import properties</h1>
          <p className="text-sm text-muted-foreground">
            Upload Genevieve&apos;s spreadsheet, paste CSV, or paste the sample
            and tweak. Preview before committing — duplicates by address+unit
            are upserted.
          </p>
        </div>
      </header>
      <PropertyImportForm />
    </section>
  )
}
