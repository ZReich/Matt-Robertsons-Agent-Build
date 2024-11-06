import { EmailView } from "../../_components/email-view";

export default function EmailViewPage({ params }: { params: { id: string } }) {
  return <EmailView emailId={params.id} />;
}
