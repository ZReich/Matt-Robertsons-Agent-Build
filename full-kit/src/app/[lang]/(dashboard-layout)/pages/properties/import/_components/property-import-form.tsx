"use client"

import { useRouter } from "next/navigation"
import { useState, type ChangeEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface PreviewRow {
  rowIndex: number
  address: string
  name?: string
  unit?: string
  propertyType?: string
  status?: string
  squareFeet?: number
  listPrice?: number
  propertyKey: string
  action: "create" | "update"
}

interface DryRunResponse {
  ok: boolean
  dryRun: true
  summary: {
    totalRows: number
    toCreate: number
    toUpdate: number
    intraFileDupes: number
    parseErrors: number
  }
  preview: PreviewRow[]
  intraFileDupes: Array<{ rowIndex: number; address: string; unit?: string }>
  parseErrors: Array<{ row: number; reason: string }>
}

interface CommitResponse {
  ok: boolean
  summary: {
    totalRows: number
    created: number
    updated: number
    errored: number
  }
  errors: Array<{ rowIndex: number; reason: string }>
}

const SAMPLE = `Name,Address,Unit,City,State,Zip,Property Type,Status,SQFT,List Price,URL
Broadway Plaza,303 N Broadway,,Billings,MT,59101,office,active,12000,2500000,https://example.com/listings/broadway
Casper Warehouse,2126 21st St,Suite A,Casper,WY,82601,industrial,active,40000,5400000,
,13 Colorado Ave,,Laurel,MT,59044,retail,under contract,5800,950000,`

export function PropertyImportForm() {
  const router = useRouter()
  const [csv, setCsv] = useState("")
  const [preview, setPreview] = useState<DryRunResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function onPasteSample() {
    setCsv(SAMPLE)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setPreview(null)
  }

  async function runDry() {
    if (!csv.trim()) {
      toast.error("Paste a CSV or upload a file first")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/properties/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun: true }),
      })
      const json = (await res.json()) as DryRunResponse | { error?: string }
      if (!res.ok || !("preview" in json)) {
        toast.error(("error" in json && json.error) || "Failed to parse")
        return
      }
      setPreview(json)
      toast.success(`Parsed ${json.summary.totalRows} rows`)
    } finally {
      setSubmitting(false)
    }
  }

  async function commit() {
    if (!preview) {
      toast.error("Run a preview first")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/properties/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun: false }),
      })
      const json = (await res.json()) as CommitResponse | { error?: string }
      if (!res.ok || !("summary" in json)) {
        toast.error(("error" in json && json.error) || "Import failed")
        return
      }
      toast.success(
        `Imported: ${json.summary.created} created, ${json.summary.updated} updated`
      )
      if (json.summary.errored > 0) {
        toast.error(`${json.summary.errored} rows errored — see logs`)
      }
      router.push(`../properties`)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Provide the CSV</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor="csv-file"
              className="cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              Upload .csv
            </Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
            <Button type="button" variant="outline" size="sm" onClick={onPasteSample}>
              Paste sample
            </Button>
            <p className="text-xs text-muted-foreground">
              Recognized headers: Name, Address, Unit, City, State, Zip, Property
              Type, Status, SQFT, Occupied SQFT, List Price, Cap Rate, URL,
              Flyer, Description
            </p>
          </div>
          <Textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value)
              setPreview(null)
            }}
            rows={10}
            className="font-mono text-xs"
            placeholder="Paste CSV content here…"
          />
          <div className="flex justify-end">
            <Button onClick={runDry} disabled={submitting || !csv.trim()}>
              Preview parse
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Review {preview.summary.totalRows} rows
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">
                {preview.summary.toCreate} to create
              </Badge>
              <Badge variant="secondary">
                {preview.summary.toUpdate} to update
              </Badge>
              {preview.summary.intraFileDupes > 0 ? (
                <Badge variant="destructive">
                  {preview.summary.intraFileDupes} duplicate rows in file
                </Badge>
              ) : null}
              {preview.summary.parseErrors > 0 ? (
                <Badge variant="destructive">
                  {preview.summary.parseErrors} parse errors
                </Badge>
              ) : null}
            </div>

            {preview.parseErrors.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="mb-1 font-medium text-destructive">Parse errors</p>
                <ul className="space-y-0.5">
                  {preview.parseErrors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">SQFT</TableHead>
                    <TableHead className="text-right">List $</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((p) => (
                    <TableRow key={p.rowIndex}>
                      <TableCell className="text-xs">{p.rowIndex}</TableCell>
                      <TableCell>
                        {p.name ? `${p.name} — ` : ""}
                        {p.address}
                        {p.unit ? ` · ${p.unit}` : ""}
                      </TableCell>
                      <TableCell className="capitalize">
                        {p.propertyType ?? "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {p.status ?? "active"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.squareFeet ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.listPrice
                          ? p.listPrice.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.action === "create" ? "default" : "secondary"
                          }
                        >
                          {p.action}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={submitting}
              >
                Re-edit CSV
              </Button>
              <Button onClick={commit} disabled={submitting}>
                {submitting ? "Importing…" : "Commit import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
