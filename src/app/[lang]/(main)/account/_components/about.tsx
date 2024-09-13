import {
  User,
  BriefcaseBusiness,
  MapPinHouse,
  Languages,
  CalendarDays,
  Mail,
  Phone,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export function About() {
  return (
    <Card>
      <CardContent className="p-2 space-y-2">
        <article className="p-4 space-y-4">
          <CardTitle>About</CardTitle>
          <ul className="text-base space-y-2">
            <li className="flex items-center gap-1">
              <User className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Full Name:</span> John Doe
            </li>
            <li className="flex items-center gap-1">
              <BriefcaseBusiness className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Role:</span> Next.js Developer
            </li>
            <li className="flex items-center gap-1">
              <MapPinHouse className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Location:</span> New York, USA
            </li>
            <li className="flex items-center gap-1">
              <Languages className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Languages:</span> English, Spanish
            </li>
            <li className="flex items-center gap-1">
              <CalendarDays className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Joined:</span>{" "}
              <time dateTime="2018-07-07">July 7, 2018</time>
            </li>
          </ul>
        </article>
        <article className="p-4 space-y-4">
          <CardTitle>Contact</CardTitle>
          <ul className="text-base space-y-2">
            <li className="flex items-center gap-1">
              <Phone className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Phone:</span>{" "}
              <a href="tel:+14155550132">+1 (415) 555‑0132</a>
            </li>
            <li className="flex items-center gap-1">
              <Mail className="size-4 stroke-[1.5]" />
              <span className="font-semibold">Email:</span>{" "}
              <a href="mailto:john.doe@example.com">john.doe@example.com</a>
              <br />
            </li>
          </ul>
        </article>
        <article className="p-4 space-y-4">
          <CardTitle>Active Teams</CardTitle>
          <ul className="text-base space-y-2">
            <li className="flex items-center gap-1">
              <Avatar className="size-4">
                <AvatarImage src="" alt="Team Avatar" />
                <AvatarFallback>F</AvatarFallback>
              </Avatar>
              Full-Stack Engineers
            </li>
            <li className="flex items-center gap-1">
              <Avatar className="size-4">
                <AvatarImage src="" alt="Team Avatar" />
                <AvatarFallback>F</AvatarFallback>
              </Avatar>
              Frontend Developers
            </li>
          </ul>
        </article>
      </CardContent>
    </Card>
  );
}
