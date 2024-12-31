import { Card } from "@/components/ui/card";
import { NotificationPreferencesHeader } from "./notification-preferences-header";
import { NotificationPreferencesContent } from "./notification-preferences-content";

export function NotificationPreferences() {
  return (
    <Card>
      <NotificationPreferencesHeader />
      <NotificationPreferencesContent />
    </Card>
  );
}
