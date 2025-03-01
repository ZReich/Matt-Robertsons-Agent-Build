import { getInitials } from "@/lib/utils";

import type { SalesRepresentativeType } from "../../../../types";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function TopSalesRepresentativesOthersItem({
  representative,
  index,
}: {
  representative: SalesRepresentativeType["representatives"][0];
  index: number;
}) {
  return (
    <li key={representative.name}>
      <Card>
        <CardContent className="flex items-center gap-x-4 py-3 px-6">
          <div className="relative">
            <Avatar className="w-10 h-10 border-2 border-secondary bg-secondary">
              <AvatarImage src={representative.avatar} alt="Avatar" />
              <AvatarFallback>
                {getInitials(representative.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-1 -right-1 w-6 h-6 border-secondary bg-secondary rounded-full flex items-center justify-center text-xs text-secondary-foreground font-semibold">
              {index + 4}
            </div>
          </div>
          <div className="flex-1 w-0">
            <h3 className="text-sm font-semibold break-all truncate">
              {representative.name}
            </h3>
            <p className="text-xs text-muted-foreground break-all truncate">
              {representative.email}
            </p>
          </div>
          <Badge className="text-sm">
            ${representative.sales.toLocaleString()}
          </Badge>
        </CardContent>
      </Card>
    </li>
  );
}
