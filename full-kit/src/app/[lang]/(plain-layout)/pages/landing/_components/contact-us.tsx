import { ContactUsInfo } from "./contact-us-info"
import { ContactUsMap } from "./contact-us-map"
import { ContactUsSendMessage } from "./contact-us-send-message"

export function ContactUs() {
  return (
    <section id="contact-us" className="container grid gap-8">
      <div className="mx-auto text-center">
        <h1 className="text-3xl font-semibold">Contact Us</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Have a question or need assistance? Fill out the form, and we&apos;ll
          get back to you as soon as possible.
        </p>
      </div>
      <div className="container grid gap-4 md:grid-cols-2">
        <ContactUsSendMessage />
        <div className="flex flex-col gap-4">
          <ContactUsMap />
          <ContactUsInfo />
        </div>
      </div>
    </section>
  )
}
