import { EmailWrapper } from "../_components/email-wrapper";

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmailWrapper>{children}</EmailWrapper>;
}
