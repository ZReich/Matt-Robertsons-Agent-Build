import { Locale } from "@/configs/i18n";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileInfoForm } from "./_components/profile-info-form";
import { DeleteAccountForm } from "./_components/delete-account-form";

const profile = {
  first_name: "John",
  last_name: "Doe",
  full_name: "John Doe",
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
};

export default function SettingsPage({ params }: { params: { lang: Locale } }) {
  const data = profile;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your public profile details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileInfoForm locale={params.lang} profile={profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dangerous Zone</CardTitle>
          <CardDescription>
            Manage sensitive settings, such as account deletion or deactivation.
            Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm locale={params.lang} profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
