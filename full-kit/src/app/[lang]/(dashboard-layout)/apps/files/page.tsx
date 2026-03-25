import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Files",
}

export default function FilesPage() {
  return (
    <section className="container grid gap-4 p-4">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="mt-2 text-muted-foreground">
          Document manager for business and personal files stored in the vault.
          File browser coming soon.
        </p>
      </div>
    </section>
  )
}
