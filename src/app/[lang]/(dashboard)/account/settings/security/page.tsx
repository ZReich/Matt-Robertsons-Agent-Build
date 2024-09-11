import { Locale } from "@/configs/i18n";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "./_components/chnage-password-form";
import { SecurityPreferencesForm } from "./_components/security-preferences-form";
import { RecentLogsTable } from "./_components/recent-logs-table";
import { AccountRecoveryOptionsForm } from "./_components/account-recovery-options-form";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure. Choose a strong,
            unique password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm locale={params.lang} profile={profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Security preferences</CardTitle>
          <CardDescription>
            Update your security settings to enhance account protection and
            manage security features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityPreferencesForm profile={profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account Recovery Options</CardTitle>
          <CardDescription>
            Set up and manage recovery options to easily regain access to your
            account if you forget your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountRecoveryOptionsForm profile={profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
          <CardDescription>
            View recent activity on your account. Check for any unusual or
            suspicious actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentLogsTable />
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="#" className={cn(buttonVariants({ variant: "link" }))}>
            View all connections
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
