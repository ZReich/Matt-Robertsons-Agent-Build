import { userData } from "@/data/user";

import type { Metadata } from "next";
import type { LocaleType } from "@/configs/i18n";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileInfoForm } from "./_components/profile-info-form";
import { DeleteAccountForm } from "./_components/delete-account-form";

export const metadata: Metadata = {
  title: "Profile Information Settings",
};

export default function ProfileInfoPage({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your public profile details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileInfoForm locale={params.lang} user={userData} />
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
          <DeleteAccountForm locale={params.lang} user={userData} />
        </CardContent>
      </Card>
    </div>
  );
}
