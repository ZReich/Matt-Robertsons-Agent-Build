import { Card } from "@/components/ui/card"
import { RecentLogsContent } from "./recent-logs-content"
import { RecentLogsFooter } from "./recent-logs-footer"
import { RecentLogsHeader } from "./recent-logs-header"

export function RecentLogs() {
  return (
    <Card>
      <RecentLogsHeader />
      <RecentLogsContent />
      <RecentLogsFooter />
    </Card>
  )
}
