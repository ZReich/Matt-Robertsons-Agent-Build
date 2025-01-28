import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function OutlineBadge() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outline Badge</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="outline">Outline</Badge>
      </CardContent>
    </Card>
  );
}
