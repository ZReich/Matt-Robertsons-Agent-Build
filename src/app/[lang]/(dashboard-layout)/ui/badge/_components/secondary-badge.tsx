import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SecondaryBadge() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Secondary Badge</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">Secondary</Badge>
      </CardContent>
    </Card>
  );
}
