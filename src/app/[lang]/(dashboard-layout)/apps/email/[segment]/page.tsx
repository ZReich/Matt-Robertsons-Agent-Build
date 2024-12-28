import { labelsData } from "../_data/labels";

import { EmailComposer } from "../_components/email-composer";
import { EmailList } from "../_components/email-list";
import { EmailNotFound } from "../_components/email-not-found";

export default async function EmailPage({
  params,
}: {
  params: { segment: string };
}) {
  const segmentParam = params.segment;

  // If the segment is 'compose', render the email composer form to create a new email
  if (segmentParam === "compose") return <EmailComposer />;

  // Check if the current segment corresponds to one of the defined labels
  const isLabel = labelsData.some((label) => label === segmentParam);

  // If the segment matches a label, display emails filtered by that label
  if (isLabel) {
    return <EmailList />;
  }

  return <EmailNotFound />;
}
