"use client"

import { Bell, Clock, Power, Shield } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

const ACTION_TIERS = [
  {
    name: "Auto",
    description: "Read data, search vault, check calendar, draft responses",
    examples: "Searching deals, reading client info, checking schedule",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  {
    name: "Log-Only",
    description: "Minor updates logged but not requiring approval",
    examples: "Mark todo done, add notes, log communications",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    name: "Approve",
    description: "Actions requiring Matt's explicit approval",
    examples: "Send email, schedule meeting, create deal, move pipeline stage",
    badge:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    name: "Blocked",
    description: "Actions never allowed — manual only",
    examples: "Delete clients, modify financials, legal responses",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
]

export function AgentConfig() {
  return (
    <div className="grid gap-4">
      {/* Action Tiers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Action Tiers</CardTitle>
          </div>
          <CardDescription>
            Configure what the agent can do autonomously vs. what needs
            approval.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="grid gap-3">
            {ACTION_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="flex items-start justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={tier.badge} variant="secondary">
                      {tier.name}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{tier.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Examples: {tier.examples}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
          <CardDescription>
            How you want to be notified about agent activity.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Pending approval alerts</p>
              <p className="text-xs text-muted-foreground">
                Get notified when the agent submits an action for approval
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily activity summary</p>
              <p className="text-xs text-muted-foreground">
                Receive a summary of all agent actions at end of day
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Error alerts</p>
              <p className="text-xs text-muted-foreground">
                Get notified immediately if the agent encounters an error
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Schedule</CardTitle>
          </div>
          <CardDescription>Set when the agent is active.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active hours</p>
              <p className="text-xs text-muted-foreground">
                Agent operates Monday-Saturday, 7:00 AM - 8:00 PM MT
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Weekend mode</p>
              <p className="text-xs text-muted-foreground">
                Reduce to read-only on weekends (no outbound actions)
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Stop */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Power className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base text-red-600">
              Emergency Stop
            </CardTitle>
          </div>
          <CardDescription>
            Immediately pause all agent actions. The agent will not take any
            actions until re-enabled.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Agent enabled</p>
              <p className="text-xs text-muted-foreground">
                Toggle off to pause all agent activity
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
