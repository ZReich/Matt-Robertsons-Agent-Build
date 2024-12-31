import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DangerousZoneHeader() {
  return (
    <CardHeader>
      <CardTitle>Dangerous Zone</CardTitle>
      <CardDescription>
        Manage sensitive settings, such as account deletion or deactivation.
        Proceed with caution.
      </CardDescription>
    </CardHeader>
  );
}
