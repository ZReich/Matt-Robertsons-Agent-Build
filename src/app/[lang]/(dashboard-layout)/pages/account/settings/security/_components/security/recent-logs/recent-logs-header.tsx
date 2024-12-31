import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RecentLogsHeader() {
  return (
    <CardHeader>
      <CardTitle>Recent Logs</CardTitle>
      <CardDescription>
        View recent activity on your account. Check for any unusual or
        suspicious actions.
      </CardDescription>
    </CardHeader>
  );
}
