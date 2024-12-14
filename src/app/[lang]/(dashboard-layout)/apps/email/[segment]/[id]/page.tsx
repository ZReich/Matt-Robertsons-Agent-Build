import { getEmailData } from "../../_actions/get-email-data";

import { EmailNotFound } from "../../_components/email-not-found";
import { EmailView } from "../../_components/email-view";

export default async function EmailViewPage({
  params,
}: {
  params: { id: string };
}) {
  const emailData = await getEmailData(params.id);

  // If no matching email is found, show a not found UI
  if (!emailData) return <EmailNotFound />;

  return <EmailView email={emailData} />;
}
