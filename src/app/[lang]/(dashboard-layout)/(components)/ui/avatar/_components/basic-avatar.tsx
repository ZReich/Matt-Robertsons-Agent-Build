import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function BasicAvatar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Avatar</CardTitle>
      </CardHeader>
      <CardContent>
        <Avatar>
          <AvatarImage src="/images/avatars/01.png" alt="John Doe" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </CardContent>
    </Card>
  );
}
