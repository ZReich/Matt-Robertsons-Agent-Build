import { Building2, CalendarClock, Mail, Phone, UserRound } from "lucide-react"

import type { Contact } from "@prisma/client"
import type { ReactNode } from "react"

interface ContactCardProps {
  contact: Pick<
    Contact,
    "name" | "email" | "phone" | "company" | "role" | "leadSource" | "leadAt"
  >
  displayName?: string | null
  displayEmail?: string | null
  displayPhone?: string | null
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode
  label: string
  value: string | null | undefined
  href?: string
}) {
  if (!value) return null
  const valueNode = href ? (
    <a
      href={href}
      className="break-all font-medium text-foreground underline-offset-4 hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className="break-words font-medium text-foreground">{value}</span>
  )

  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-muted-foreground">{label}</div>
        {valueNode}
      </div>
    </div>
  )
}

function sourceLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function ContactCard({
  contact,
  displayName,
  displayEmail,
  displayPhone,
}: ContactCardProps) {
  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
        Contact
      </div>
      <Row
        icon={<UserRound className="size-3.5" />}
        label="Name"
        value={displayName ?? contact.name}
      />
      <Row
        icon={<Mail className="size-3.5" />}
        label="Email"
        value={displayEmail ?? contact.email}
        href={
          (displayEmail ?? contact.email)
            ? `mailto:${displayEmail ?? contact.email}`
            : undefined
        }
      />
      <Row
        icon={<Phone className="size-3.5" />}
        label="Phone"
        value={displayPhone ?? contact.phone}
        href={
          (displayPhone ?? contact.phone)
            ? `tel:${(displayPhone ?? contact.phone)?.replace(/\D/g, "")}`
            : undefined
        }
      />
      <Row
        icon={<Building2 className="size-3.5" />}
        label="Company"
        value={contact.company}
      />
      <Row
        icon={<UserRound className="size-3.5" />}
        label="Role"
        value={contact.role}
      />
      <Row
        icon={<CalendarClock className="size-3.5" />}
        label="Source"
        value={
          contact.leadSource && contact.leadAt
            ? `${sourceLabel(contact.leadSource)} - ${contact.leadAt.toLocaleDateString()}`
            : null
        }
      />
    </section>
  )
}
