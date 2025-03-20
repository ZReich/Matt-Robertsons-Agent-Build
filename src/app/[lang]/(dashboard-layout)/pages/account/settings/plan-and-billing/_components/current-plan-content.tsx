import { currentPlanData } from "../../../_data/curremt-plan"

import { formatFileSize } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DynamicIcon } from "@/components/dynamic-icon"

export function CurrentPlanContent() {
  return (
    <CardContent className="space-y-6">
      <Badge variant="secondary" className="grid w-fit text-lg">
        <p>
          {currentPlanData.plan.name}{" "}
          <span className="text-sm">{currentPlanData.plan.price}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {currentPlanData.plan.description}
        </p>
      </Badge>
      <div className="grid gap-6">
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <p className="text-muted-foreground">Active Projects</p>
            <p className="font-medium">
              {currentPlanData.stats.activeProjects.value} /{" "}
              {currentPlanData.stats.activeProjects.max}
            </p>
          </div>
          <Progress
            value={currentPlanData.stats.activeProjects.progress}
            className="h-2"
          />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <p className="text-muted-foreground">Team Members</p>
            <p className="font-medium">
              {currentPlanData.stats.teamMembers.value} /{" "}
              {currentPlanData.stats.teamMembers.max}
            </p>
          </div>
          <Progress
            value={currentPlanData.stats.teamMembers.progress}
            className="h-2"
          />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <p className="text-muted-foreground">Storage Used</p>
            <p className="font-medium">
              {formatFileSize(currentPlanData.stats.storageUsed.value)} /{" "}
              {formatFileSize(currentPlanData.stats.storageUsed.max)}
            </p>
          </div>
          <Progress
            value={currentPlanData.stats.storageUsed.progress}
            className="h-2"
          />
        </div>
      </div>
      <div>
        <h4 className="font-semibold mb-2">This Month&apos;s Activity</h4>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {currentPlanData.activityThisMonth.map((item, index) => (
            <li key={index} className="flex items-center gap-x-2">
              <Badge className="size-12 aspect-square shadow-none" aria-hidden>
                <DynamicIcon name={item.iconName} className="size-full" />
              </Badge>
              <div>
                <h4 className="text-sm text-muted-foreground leading-tight break-all truncate">
                  {item.label}
                </h4>
                <p className="text-2xl font-semibold">{item.count}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </CardContent>
  )
}
