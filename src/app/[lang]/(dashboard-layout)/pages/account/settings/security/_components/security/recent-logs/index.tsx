import { Card } from "@/components/ui/card";
import { RecentLogsHeader } from "./recent-logs-header";
import { RecentLogsContent } from "./recent-logs-content";
import { RecentLogsFooter } from "./recent-logs-footer";

export function RecentLogs() {
  return (
    <Card>
      <RecentLogsHeader />
      <RecentLogsContent />
      <RecentLogsFooter />
    </Card>
  );
}
