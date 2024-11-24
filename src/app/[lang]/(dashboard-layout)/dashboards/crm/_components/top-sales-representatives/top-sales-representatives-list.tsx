import { cn, getInitials } from "@/lib/utils";

import type { SalesRepresentativeType } from "../../types";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const medalAvatarColor = [
  "bg-yellow-400 border-yellow-400 dark:bg-yellow-500 dark:border-yellow-500",
  "bg-gray-300 border-gray-300 dark:bg-gray-400 dark:border-gray-400",
  "bg-amber-600 border-amber-600 dark:bg-amber-700 dark:border-amber-700",
];

const medalCardColor = [
  "bg-yellow-400/15 border-yellow-400 dark:border-yellow-500",
  "bg-gray-300/15 border-gray-300 dark:border-gray-400",
  "bg-amber-600/15 border-amber-600 dark:border-amber-700",
];

export function TopSalesRepresentativesList({
  data,
}: {
  data: SalesRepresentativeType[];
}) {
  const top3 = data.slice(0, 3);
  const others = data.slice(3);

  return (
    <ul className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((rep, index) => (
          <li key={rep.name}>
            <Card className={medalCardColor[index]}>
              <CardContent className="flex flex-col items-center gap-y-3 p-6">
                <div className="relative">
                  <Avatar
                    className={cn(
                      "w-20 h-20 border-2",
                      medalAvatarColor[index]
                    )}
                  >
                    <AvatarImage src={rep.avatar} alt="Avatar" />
                    <AvatarFallback>{getInitials(rep.name)}</AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-xs text-black font-semibold",
                      medalAvatarColor[index]
                    )}
                  >
                    {index + 1}
                  </div>
                </div>
                <div className="w-full text-center">
                  <h4 className="text-lg font-semibold break-all truncate">
                    {rep.name}
                  </h4>
                  <p className="text-xs text-muted-foreground break-all truncate">
                    {rep.email}
                  </p>
                </div>
                <Badge className="text-sm">${rep.sales.toLocaleString()}</Badge>
              </CardContent>
            </Card>
          </li>
        ))}
      </div>

      <div className="space-y-4">
        {others.map((rep, index) => (
          <li key={rep.name}>
            <Card>
              <CardContent className="flex items-center gap-x-4 p-3">
                <div className="relative">
                  <Avatar className="w-12 h-12 border-2 border-secondary bg-secondary">
                    <AvatarImage src={rep.avatar} alt="Avatar" />
                    <AvatarFallback>{getInitials(rep.name)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-secondary bg-secondary rounded-full flex items-center justify-center text-xs text-secondary-foreground font-semibold">
                    {index + 4}
                  </div>
                </div>
                <div className="w-full">
                  <h4 className="text-sm font-semibold break-all truncate">
                    {rep.name}
                  </h4>
                  <p className="text-xs text-muted-foreground break-all truncate">
                    {rep.email}
                  </p>
                </div>
                <Badge className="text-sm">${rep.sales.toLocaleString()}</Badge>
              </CardContent>
            </Card>
          </li>
        ))}
      </div>
    </ul>
  );
}
