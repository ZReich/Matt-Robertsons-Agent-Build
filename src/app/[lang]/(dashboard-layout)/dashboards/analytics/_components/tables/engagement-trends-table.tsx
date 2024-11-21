"use client";

import { Monitor } from "lucide-react";
import {
  SiLinux,
  SiAndroid,
  SiApple,
  SiWindows11,
  SiGooglechrome,
} from "react-icons/si";

import { formatDuration } from "@/lib/date-formatters";

import type { EngagementByDeviceType } from "../../types";

import { Progress } from "@/components/ui/progress";

const deviceIcons = {
  Windows: SiWindows11,
  macOS: SiApple,
  iOS: SiApple,
  Android: SiAndroid,
  ChromeOS: SiGooglechrome,
  Linux: SiLinux,
  Other: Monitor,
};

export function EngagementByDeviceTable({
  data,
}: {
  data: EngagementByDeviceType[];
}) {
  const maxDuration = Math.max(...data.map((device) => device.sessionDuration));
  const maxPages = Math.max(...data.map((device) => device.pagesPerSession));

  return (
    <ul className="grid gap-6 md:grid-cols-4">
      {data.map((device) => {
        const Icon = deviceIcons[device.deviceType as keyof typeof deviceIcons];

        return (
          <li key={device.deviceType} className="space-y-1.5">
            <h4 className="flex items-center gap-x-2 font-semibold">
              <Icon
                className="h-4 w-4 text-foreground fill-foreground"
                aria-hidden
              />
              <span>{device.deviceType}</span>
            </h4>
            <ul>
              <li>
                <span className="text-sm text-muted-foreground">
                  Avg. Session Duration:{" "}
                  {formatDuration(device.sessionDuration)}
                </span>
                <Progress
                  value={(device.sessionDuration / maxDuration) * 100}
                />
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Pages/Session: {device.pagesPerSession.toFixed(1)}
                </span>
                <Progress value={(device.pagesPerSession / maxPages) * 100} />
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Bounce Rate:{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }).format(device.bounceRate)}
                </span>
                <Progress value={device.bounceRate * 100} />
              </li>
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
