import { Card } from "@/components/ui/card"
import { NotificationPreferencesContent } from "./notification-preferences-content"
import { NotificationPreferencesHeader } from "./notification-preferences-header"

export function NotificationPreferences() {
  return (
    <Card>
      <NotificationPreferencesHeader />
      <NotificationPreferencesContent />
    </Card>
  )
}
