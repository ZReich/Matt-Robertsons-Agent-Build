import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DestructiveBadge() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Destructive Badge</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="destructive">Destructive</Badge>
      </CardContent>
    </Card>
  );
}
