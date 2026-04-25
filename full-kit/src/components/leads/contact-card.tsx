import type { Contact } from "@prisma/client"

interface ContactCardProps {
  contact: Pick<
    Contact,
    "email" | "phone" | "company" | "role" | "leadSource" | "leadAt"
  >
}

function Row({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null

  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  )
}

export function ContactCard({ contact }: ContactCardProps) {
  return (
    <div className="space-y-1.5">
      <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
        Contact
      </div>
      <Row label="Email" value={contact.email} />
      <Row label="Phone" value={contact.phone} />
      <Row label="Company" value={contact.company} />
      <Row label="Role" value={contact.role} />
      <Row
        label="Source"
        value={
          contact.leadSource && contact.leadAt
            ? `${contact.leadSource} - ${contact.leadAt.toLocaleDateString()}`
            : null
        }
      />
    </div>
  )
}
