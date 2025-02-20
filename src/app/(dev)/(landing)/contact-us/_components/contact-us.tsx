import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ContactUsForm } from "./contact-us-form";

export function ContactUs() {
  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="text-xl font-semibold leading-none tracking-tight">
          Get in touch
        </h1>
        <CardDescription className="max-w-prose w-full">
          Have a question or need assistance? Fill out the form, and we&apos;ll
          get back to you as soon as possible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContactUsForm />
      </CardContent>
    </Card>
  );
}
