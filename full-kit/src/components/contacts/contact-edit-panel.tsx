"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { PropertyType } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const PRESET_TAGS: { value: string; label: string; helper?: string }[] = [
  { value: "owner", label: "Owner", helper: "Property owner" },
  { value: "tenant", label: "Tenant" },
  { value: "buyer", label: "Buyer", helper: "Acquiring property" },
  { value: "investor", label: "Investor" },
  { value: "referrer", label: "Referrer", helper: "Sends Matt deals" },
  {
    value: "referral",
    label: "Referral",
    helper: "Came from someone Matt knows",
  },
  { value: "christmas-mailer", label: "Christmas mailer" },
  { value: "do-not-contact", label: "Do not contact" },
]

const CRITERIA_PROPERTY_TYPES: PropertyType[] = [
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

export interface SearchCriteriaShape {
  propertyTypes?: PropertyType[]
  minSqft?: number
  maxSqft?: number
  minPrice?: number
  maxPrice?: number
  locations?: string[]
  notes?: string
}

export interface ContactEditPanelProps {
  contactId: string
  initialTags: string[]
  initialNotes: string | null
  initialSearchCriteria: SearchCriteriaShape | null
}

function arrayToggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
}

export function ContactEditPanel({
  contactId,
  initialTags,
  initialNotes,
  initialSearchCriteria,
}: ContactEditPanelProps) {
  const router = useRouter()
  const [tags, setTags] = useState<string[]>(initialTags)
  const [customTagInput, setCustomTagInput] = useState("")
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [criteria, setCriteria] = useState<SearchCriteriaShape>(
    initialSearchCriteria ?? {}
  )
  const [locationInput, setLocationInput] = useState("")
  const [savingTags, setSavingTags] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savingCriteria, setSavingCriteria] = useState(false)

  const showCriteria =
    tags.includes("buyer") ||
    tags.includes("tenant") ||
    tags.includes("investor")

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      toast.error(json.error ?? "Save failed")
      return false
    }
    return true
  }

  async function saveTags(nextTags: string[]) {
    setSavingTags(true)
    try {
      const ok = await patch({ tags: nextTags })
      if (ok) {
        setTags(nextTags)
        router.refresh()
      }
    } finally {
      setSavingTags(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const ok = await patch({
        notes: notes.trim().length === 0 ? null : notes,
      })
      if (ok) {
        toast.success("Notes saved")
        router.refresh()
      }
    } finally {
      setSavingNotes(false)
    }
  }

  async function saveCriteria(next: SearchCriteriaShape) {
    setSavingCriteria(true)
    try {
      const ok = await patch({
        searchCriteria:
          Object.keys(next).length === 0 || allEmpty(next) ? null : next,
      })
      if (ok) {
        setCriteria(next)
        router.refresh()
      }
    } finally {
      setSavingCriteria(false)
    }
  }

  function addCustomTag() {
    const raw = customTagInput.trim().toLowerCase().replace(/\s+/g, "-")
    if (!raw) return
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(raw)) {
      toast.error("Tag must be a-z, 0-9, _ or -")
      return
    }
    if (tags.includes(raw)) return
    setCustomTagInput("")
    void saveTags([...tags, raw])
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map((t) => {
              const active = tags.includes(t.value)
              return (
                <button
                  key={t.value}
                  type="button"
                  disabled={savingTags}
                  onClick={() => saveTags(arrayToggle(tags, t.value))}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/40")
                  }
                  title={t.helper}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {tags.filter((t) => !PRESET_TAGS.some((p) => p.value === t)).length >
          0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Custom:</span>
              {tags
                .filter((t) => !PRESET_TAGS.some((p) => p.value === t))
                .map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => saveTags(tags.filter((x) => x !== t))}
                  >
                    {t} ✕
                  </Badge>
                ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Input
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              placeholder="Add custom tag (e.g. cre-conf-2026)"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCustomTag()
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addCustomTag}
              disabled={savingTags || !customTagInput.trim()}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Notes
          </CardTitle>
          <Button
            size="sm"
            onClick={saveNotes}
            disabled={savingNotes}
            variant="default"
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything Matt wants to remember about this contact — preferences, family, current deals on their plate, why they bought last time, etc."
          />
        </CardContent>
      </Card>

      {showCriteria ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Buyer / tenant criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label className="text-xs">Property types they want</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {CRITERIA_PROPERTY_TYPES.map((t) => {
                  const active = (criteria.propertyTypes ?? []).includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setCriteria({
                          ...criteria,
                          propertyTypes: arrayToggle(
                            criteria.propertyTypes ?? [],
                            t
                          ),
                        })
                      }
                      className={
                        "rounded-full border px-3 py-1 text-xs capitalize transition " +
                        (active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:border-primary/40")
                      }
                    >
                      {t.replace(/_/g, " ")}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Min SQFT</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={criteria.minSqft ?? ""}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      minSqft:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Max SQFT</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={criteria.maxSqft ?? ""}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      maxSqft:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Min price ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={criteria.minPrice ?? ""}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      minPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Max price ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={criteria.maxPrice ?? ""}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      maxPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Locations</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(criteria.locations ?? []).map((l) => (
                  <Badge
                    key={l}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() =>
                      setCriteria({
                        ...criteria,
                        locations: (criteria.locations ?? []).filter(
                          (x) => x !== l
                        ),
                      })
                    }
                  >
                    {l} ✕
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Add location (e.g. Kalispell, Billings, downtown)"
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const v = locationInput.trim()
                      if (v && !(criteria.locations ?? []).includes(v)) {
                        setCriteria({
                          ...criteria,
                          locations: [...(criteria.locations ?? []), v],
                        })
                        setLocationInput("")
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const v = locationInput.trim()
                    if (v && !(criteria.locations ?? []).includes(v)) {
                      setCriteria({
                        ...criteria,
                        locations: [...(criteria.locations ?? []), v],
                      })
                      setLocationInput("")
                    }
                  }}
                  disabled={!locationInput.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">
                Free-form notes about their criteria
              </Label>
              <Textarea
                rows={3}
                value={criteria.notes ?? ""}
                onChange={(e) =>
                  setCriteria({ ...criteria, notes: e.target.value })
                }
                placeholder="e.g. wants ground-floor retail with parking, ten-year hold, 1031 buyer with ~$2M to deploy"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveCriteria(criteria)}
                disabled={savingCriteria}
              >
                {savingCriteria ? "Saving…" : "Save criteria"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Buyer / tenant criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tag this contact as <strong>buyer</strong>,{" "}
              <strong>tenant</strong>, or <strong>investor</strong> above to
              capture what they&apos;re looking for. Criteria-tagged contacts
              get matched against the property catalog automatically.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function allEmpty(c: SearchCriteriaShape): boolean {
  if (c.propertyTypes && c.propertyTypes.length > 0) return false
  if (c.minSqft !== undefined) return false
  if (c.maxSqft !== undefined) return false
  if (c.minPrice !== undefined) return false
  if (c.maxPrice !== undefined) return false
  if (c.locations && c.locations.length > 0) return false
  if (c.notes && c.notes.trim().length > 0) return false
  return true
}
