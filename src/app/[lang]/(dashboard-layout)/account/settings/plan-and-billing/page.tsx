import { Locale } from "@/configs/i18n";

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

const plans = [
  {
    id: 1,
    name: "Starter",
    price: 9.99,
    features: [
      "Up to 5 active projects",
      "Up to 10 team members",
      "20 GB storage",
      "Basic project analytics",
      "Email support",
    ],
  },
  {
    id: 2,
    name: "Business",
    price: 19.99,
    features: [
      "Up to 20 active projects",
      "Up to 25 team members",
      "100 GB storage",
      "Advanced project analytics",
      "Custom workflows",
      "Priority support",
      "API access",
    ],
  },
  {
    id: 3,
    name: "Enterprise",
    price: 199.99,
    features: [
      "Unlimited active projects",
      "Unlimited team members",
      "Unlimited storage",
      "Advanced project analytics",
      "Custom workflows",
      "Dedicated support",
      "API access",
      "Custom integrations",
      "On-premise deployment option",
    ],
  },
];

const subscriptions = [
  {
    id: 1,
    plan_id: 1,
    interval: "monthly",
    start_date: "2024-09-01T10:30:00.000Z",
    end_date: "2024-10-01T10:30:00.000Z",
    status: "active",
  },
  {
    id: 2,
    plan_id: 2,
    interval: "monthly",
    start_date: "2024-09-02T11:00:00.000Z",
    end_date: "2024-10-02T11:00:00.000Z",
    status: "active",
    created_at: "2024-09-02T11:00:00.000Z",
    updated_at: "2024-09-02T11:00:00.000Z",
  },
  {
    id: 3,
    plan_id: 3,
    interval: "monthly",
    start_date: "2023-09-01T11:30:00.000Z",
    end_date: "2024-09-01T11:30:00.000Z",
    status: "expired",
    created_at: "2023-09-01T11:30:00.000Z",
    updated_at: "2024-09-01T11:30:00.000Z",
  },
];

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

export default function PlanAndBillingPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const data = profile;

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
          <ChangePlanForm plans={plans} subscriptions={subscriptions} />
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
