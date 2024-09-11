import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Locale } from "@/configs/i18n";
import { NotificationPreferencesForm } from "./_components/notifications-preferenes-Form";

const profile = {
  first_name: "John",
  last_name: "Doe",
  username: "john.doe",
  role: "Next.js Developer",
  avatar: "/images/avatars/04.png",
  background: "/images/background.jpg",
  phone_number: "+1 (555) 123-4567",
  email: "john.doe@example.com",
  state: "California",
  country: "United States",
  address: "123 Main Street, Apt 4B",
  zip_code: "90210",
  language: "English",
  time_zone: "PST",
  currency: "USD",
  organization: "Tech Innovations Inc.",
  two_factor_auth: false,
  login_alerts: true,
};

export default function SecurityPage({ params }: { params: { lang: Locale } }) {
  const data = profile;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Adjust your settings to control which notifications you receive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm />
        </CardContent>
      </Card>
    </div>
  );
}
