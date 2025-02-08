import { currentPlanData } from "../../../../../_data/curremt-plan";

import { formatFileSize } from "@/lib/utils";

import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/dynamic-icon";

export function CurrentPlanContent() {
  return (
    <CardContent className="space-y-6">
      <Badge variant="secondary" className="grid w-fit text-lg">
        <span>
          {currentPlanData.plan.name}{" "}
          <span className="text-sm">{currentPlanData.plan.price}</span>
        </span>
        <span className="text-muted-foreground text-sm">
          {currentPlanData.plan.description}
        </span>
      </Badge>
      <div className="grid gap-6">
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Active Projects</span>
            <span className="font-medium">
              {currentPlanData.stats.activeProjects.value} /{" "}
              {currentPlanData.stats.activeProjects.max}
            </span>
          </div>
          <Progress
            value={currentPlanData.stats.activeProjects.progress}
            className="h-2"
          />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Team Members</span>
            <span className="font-medium">
              {currentPlanData.stats.teamMembers.value} /{" "}
              {currentPlanData.stats.teamMembers.max}
            </span>
          </div>
          <Progress
            value={currentPlanData.stats.teamMembers.progress}
            className="h-2"
          />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Storage Used</span>
            <span className="font-medium">
              {formatFileSize(currentPlanData.stats.storageUsed.value)} /{" "}
              {formatFileSize(currentPlanData.stats.storageUsed.max)}
            </span>
          </div>
          <Progress
            value={currentPlanData.stats.storageUsed.progress}
            className="h-2"
          />
        </div>
      </div>
      <div>
        <h4 className="font-semibold mb-2">This Month&apos;s Activity</h4>
        <div className="grid grid-cols-2 gap-4">
          {currentPlanData.activityThisMonth.map((item, index) => (
            <div key={index} className="flex items-center">
              <DynamicIcon
                name={item.iconName}
                className="h-5 w-5 me-2 text-primary"
              />
              <div>
                <p className="text-sm font-medium">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
}
