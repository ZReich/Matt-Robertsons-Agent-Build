import Link from "next/link";

import { userData } from "@/data/user";

import { cn } from "@/lib/utils";

import type { Metadata } from "next";

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
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Security Settings",
};

export default function SecurityPage() {
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
          <ChangePasswordForm user={userData} />
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
          <SecurityPreferencesForm user={userData} />
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
          <AccountRecoveryOptionsForm user={userData} />
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
          <Link href="/" className={cn(buttonVariants({ variant: "link" }))}>
            View all connections
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
