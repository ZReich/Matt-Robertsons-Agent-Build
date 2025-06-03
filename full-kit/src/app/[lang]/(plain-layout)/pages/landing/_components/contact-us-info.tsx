import { contactUsInfoData } from "../_data/contact-us-info"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export function ContactUsInfo() {
  return (
    <Card className="p-6" asChild>
      <ul className="grid gap-3 md:grid-cols-2 md:place-items-center">
        {contactUsInfoData.map((item) => (
          <li key={item.title} className="flex items-center gap-x-2">
            <Badge className="size-12 aspect-square" aria-hidden>
              <item.icon className="size-full" />
            </Badge>
            <div className="shrink-0">
              <h3 className="text-sm text-muted-foreground leading-tight">
                {item.title}
              </h3>
              <p className="font-semibold">{item.value}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
