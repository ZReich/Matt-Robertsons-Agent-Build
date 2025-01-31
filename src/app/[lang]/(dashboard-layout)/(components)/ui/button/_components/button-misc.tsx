import Link from "next/link";
import { Loader2, MailOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ButtonMisc() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Button MISC</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap justify-center items-center gap-2">
        <div className="space-y-1.5">
          <h4>With Icon</h4>
          <Button>
            <MailOpen /> Login with Email
          </Button>
        </div>
        <div className="space-y-1.5">
          <h4>Loading</h4>
          <Button disabled>
            <Loader2 className="animate-spin" />
            Please wait
          </Button>
        </div>
        <div className="space-y-1.5">
          <h4>As Child</h4>
          <Button asChild>
            <Link href="">Login</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
