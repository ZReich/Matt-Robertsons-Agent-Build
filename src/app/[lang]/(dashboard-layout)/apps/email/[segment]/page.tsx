import { sidebarItemsData } from "../_data/emails-sidebar-items"

import type { EmailSidebarItemType } from "../types"

import { EmailComposer } from "../_components/email-composer"
import { EmailList } from "../_components/email-list"
import { EmailNotFound } from "../_components/email-not-found"

export default async function EmailPage({
  params,
}: {
  params: { segment: string }
}) {
  const segmentParam = params.segment

  // If the segment is 'compose', render the email composer form to create a new email
  if (segmentParam === "compose") return <EmailComposer />

  // Check if the current segment corresponds to one of the defined sidebar items
  const isSidebarItem = Object.entries(sidebarItemsData).some(([_, items]) => {
    return items.some(
      (item: EmailSidebarItemType) => item.name === segmentParam
    )
  })

  // If the segment matches a sidebar item, display emails filtered by that item
  if (isSidebarItem) {
    return <EmailList />
  }

  return <EmailNotFound />
}
