import { Card } from "@/components/ui/card"
import { RecentLogsContent } from "./recent-logs-content"
import { RecentLogsHeader } from "./recent-logs-header"

export function RecentLogs() {
  return (
    <Card>
      <RecentLogsHeader />
      <RecentLogsContent />
    </Card>
  )
}
