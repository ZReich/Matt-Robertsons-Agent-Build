import { plansData } from "../../_data/plans";
import { subscriptionsData } from "../../_data/subscriptions";

import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, FileText, BarChart2 } from "lucide-react";
import { ChangePlanForm } from "./_components/change-plan-form";
import { PaymentMethodForm } from "./_components/payment-method-form";
import { SavedCardsList } from "./_components/saved-cards-list";

export const metadata: Metadata = {
  title: "Plan and Billing Settings",
};

export default async function PlanAndBillingPage() {
  return (
    <div className="grid gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Review details of your subscription plan and manage your billing
            options.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Badge variant="secondary" className="grid w-fit text-lg">
            <span>
              Business Pro <span className="text-sm">$49/month</span>
            </span>
            <span className="text-muted-foreground text-sm">
              Ideal for growing teams and businesses
            </span>
          </Badge>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Active Projects</span>
                  <span className="font-medium">15 / 20</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Team Members</span>
                  <span className="font-medium">18 / 25</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-medium">45 GB / 100 GB</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="pt-4">
                <h3 className="font-semibold mb-2">
                  This Month&apos;s Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <p className="text-sm font-medium">32</p>
                      <p className="text-xs text-muted-foreground">
                        New Projects
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <p className="text-sm font-medium">128</p>
                      <p className="text-xs text-muted-foreground">
                        New Clients
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <p className="text-sm font-medium">287</p>
                      <p className="text-xs text-muted-foreground">
                        Documents Created
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <BarChart2 className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <p className="text-sm font-medium">14</p>
                      <p className="text-xs text-muted-foreground">
                        Reports Generated
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Next billing date: July 1, 2023
            </p>
            <p className="text-sm text-muted-foreground">Amount due: $49.00</p>
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change Plan</CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs. Prices shown are per
            month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePlanForm plans={plansData} subscriptions={subscriptionsData} />
        </CardContent>
      </Card>
      <PaymentMethodForm />
      <Card>
        <CardHeader>
          <CardTitle>Saved Cards</CardTitle>
          <CardDescription>
            View and manage your stored payment cards for easy checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SavedCardsList />
        </CardContent>
      </Card>
    </div>
  );
}
