import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContactUsForm } from "./contact-us-form"

export function ContactUsSendMessage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Send a Message</CardTitle>
        <CardDescription className="max-w-prose">
          Whether you have questions about features, want to report an issue, or
          just want to share feedback about the dashboard, we’d love to hear
          from you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContactUsForm />
      </CardContent>
    </Card>
  )
}
