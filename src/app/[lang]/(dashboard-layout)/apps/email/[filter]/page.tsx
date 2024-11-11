import { getEmailsData } from "../_actions/get-emails-data";

import { EmailComposerForm } from "../_components/email-composer-form";
import { EmailList } from "../_components/email-list";

export const labels = ["inbox", "sent", "draft", "starred", "spam", "trash"];

export default async function EmailPage({
  params,
  searchParams,
}: {
  params: { filter: string };
  searchParams: { page?: string };
}) {
  const filterParam = params.filter;
  const pageQuery = searchParams.page || "1";

  const isValidFilterParam = labels.some((label) => label === filterParam);

  if (isValidFilterParam) {
    const emailsData = await getEmailsData(parseInt(pageQuery), filterParam);

    return <EmailList emails={emailsData} />;
  }

  if (filterParam === "compose") return <EmailComposerForm />;
}
