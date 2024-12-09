import { getEmailData } from "../../_actions/get-email-data";

import { EmailView } from "../../_components/email-view";

export default async function EmailViewPage({
  params,
}: {
  params: { id: string };
}) {
  const emailData = await getEmailData(params.id);

  // If the email data is not found, throw an error indicating that the email does not exist
  if (!emailData) throw new Error("This Email does not exist.");

  return <EmailView email={emailData} />;
}
