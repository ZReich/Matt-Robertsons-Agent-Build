import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DefaultBadge() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Badge</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge>Badge</Badge>
      </CardContent>
    </Card>
  );
}
