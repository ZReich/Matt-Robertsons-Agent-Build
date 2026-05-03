"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import type { PropertyStatus, PropertyType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const PROPERTY_TYPES: PropertyType[] = [
  "office",
  "retail",
  "industrial",
  "multifamily",
  "land",
  "mixed_use",
  "hospitality",
  "medical",
  "other",
]

const STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "under_contract", label: "Under contract" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
]

export interface PropertyFormInitial {
  id?: string
  name?: string | null
  address?: string
  unit?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  propertyType?: PropertyType | null
  status?: PropertyStatus
  squareFeet?: number | null
  occupiedSquareFeet?: number | null
  listPrice?: number | null
  capRate?: number | null
  listingUrl?: string | null
  flyerUrl?: string | null
  description?: string | null
}

export function PropertyForm({
  initial,
  lang,
}: {
  initial?: PropertyFormInitial
  lang: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    unit: initial?.unit ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    zip: initial?.zip ?? "",
    propertyType: (initial?.propertyType ?? "") as PropertyType | "",
    status: initial?.status ?? "active",
    squareFeet: initial?.squareFeet?.toString() ?? "",
    occupiedSquareFeet: initial?.occupiedSquareFeet?.toString() ?? "",
    listPrice: initial?.listPrice?.toString() ?? "",
    capRate: initial?.capRate?.toString() ?? "",
    listingUrl: initial?.listingUrl ?? "",
    flyerUrl: initial?.flyerUrl ?? "",
    description: initial?.description ?? "",
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.address.trim()) {
      toast.error("Address is required")
      return
    }
    setSubmitting(true)
    try {
      const isEdit = Boolean(initial?.id)
      const url = isEdit
        ? `/api/properties/${initial!.id}`
        : "/api/properties"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyType: form.propertyType || undefined,
          squareFeet: form.squareFeet ? Number(form.squareFeet) : undefined,
          occupiedSquareFeet: form.occupiedSquareFeet
            ? Number(form.occupiedSquareFeet)
            : undefined,
          listPrice: form.listPrice ? Number(form.listPrice) : undefined,
          capRate: form.capRate ? Number(form.capRate) : undefined,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; property?: { id: string }; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Failed to save property")
        return
      }
      toast.success(isEdit ? "Property updated" : "Property created")
      const id = json.property?.id ?? initial?.id
      if (id) {
        router.push(`/${lang}/pages/properties/${id}`)
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Broadway Plaza"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">
              Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="303 N Broadway"
              required
            />
          </div>
          <div>
            <Label htmlFor="unit">Unit / Suite</Label>
            <Input
              id="unit"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
              placeholder="Suite A"
            />
          </div>
          <div />
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Billings"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => update("state", e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="MT"
              />
            </div>
            <div>
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                placeholder="59101"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="propertyType">Property type</Label>
            <Select
              value={form.propertyType || undefined}
              onValueChange={(v) => update("propertyType", v as PropertyType)}
            >
              <SelectTrigger id="propertyType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v as PropertyStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specs &amp; pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="squareFeet">Square feet</Label>
            <Input
              id="squareFeet"
              type="number"
              inputMode="numeric"
              value={form.squareFeet}
              onChange={(e) => update("squareFeet", e.target.value)}
              placeholder="12000"
            />
          </div>
          <div>
            <Label htmlFor="occupiedSquareFeet">Occupied SQFT</Label>
            <Input
              id="occupiedSquareFeet"
              type="number"
              inputMode="numeric"
              value={form.occupiedSquareFeet}
              onChange={(e) => update("occupiedSquareFeet", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="listPrice">List price ($)</Label>
            <Input
              id="listPrice"
              type="number"
              inputMode="decimal"
              value={form.listPrice}
              onChange={(e) => update("listPrice", e.target.value)}
              placeholder="2500000"
            />
          </div>
          <div>
            <Label htmlFor="capRate">Cap rate (%)</Label>
            <Input
              id="capRate"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.capRate}
              onChange={(e) => update("capRate", e.target.value)}
              placeholder="6.5"
            />
          </div>
          <div>
            <Label htmlFor="listingUrl">Listing URL (Buildout / LoopNet / Crexi)</Label>
            <Input
              id="listingUrl"
              type="url"
              value={form.listingUrl}
              onChange={(e) => update("listingUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="flyerUrl">Flyer URL</Label>
            <Input
              id="flyerUrl"
              type="url"
              value={form.flyerUrl}
              onChange={(e) => update("flyerUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              placeholder="Highlights, location notes, value-add story…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : initial?.id ? "Save changes" : "Create property"}
        </Button>
      </div>
    </form>
  )
}
