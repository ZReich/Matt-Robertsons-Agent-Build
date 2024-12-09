import { notFound } from "next/navigation";

import { getEmailsData } from "../_actions/get-emails-data";
import { labelsData } from "../_data/labels";

import { EmailComposerForm } from "../_components/email-composer-form";
import { EmailList } from "../_components/email-list";

export default async function EmailPage({
  params,
  searchParams,
}: {
  params: { segment: string };
  searchParams: { page?: string };
}) {
  const segmentParam = params.segment;
  const pageQuery = searchParams.page || "1"; // Defaults to page 1 if not provided

  // Check if the current segment corresponds to one of the defined labels
  const isLabel = labelsData.some((label) => label === segmentParam);

  // If the segment matches a label, fetch and display emails filtered by that label
  if (isLabel) {
    const emailsData = await getEmailsData(parseInt(pageQuery), segmentParam);

    return <EmailList emails={emailsData} />;
  }

  // If the segment is 'compose', render the email composer form to create a new email
  if (segmentParam === "compose") return <EmailComposerForm />;

  // Otherwize display Not Found page
  notFound();
}
