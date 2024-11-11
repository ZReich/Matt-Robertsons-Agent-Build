import { getEmailData } from "../../_actions/get-email-data";

import { EmailView } from "../../_components/email-view";

export default async function EmailViewPage({
  params,
}: {
  params: { id: string };
}) {
  const emailData = await getEmailData(params.id);

  if (!emailData) throw new Error("Something went wrong.");

  return <EmailView email={emailData} />;
}
