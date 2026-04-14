import { FileText } from "lucide-react"

import type { TemplateMeta } from "@/lib/vault"
import type { Metadata } from "next"

import { listNotes } from "@/lib/vault"

import { TemplateViewer } from "./_components/template-viewer"

export const metadata: Metadata = {
  title: "Templates",
}

export default async function TemplatesPage() {
  const notes = await listNotes<TemplateMeta>("templates")
  const templates = notes.filter((n) => n.meta.type === "template")

  return (
    <section className="container max-w-5xl grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? "s" : ""} —
            click to preview and copy
          </p>
        </div>
      </div>

      <TemplateViewer templates={templates} />
    </section>
  )
}
