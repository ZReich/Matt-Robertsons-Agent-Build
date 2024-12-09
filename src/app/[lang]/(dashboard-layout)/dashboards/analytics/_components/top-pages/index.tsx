import { topPagesData } from "../../_data/top-pages";

import { TopPagesTable } from "./top-pages-table";
import { DashboardCard } from "@/components/dashboard-card";
import { ScrollArea } from "@/components/ui/scroll-area";

export async function TopPages() {
  return (
    <DashboardCard title="Top Pages" period="Last month">
      <ScrollArea
        orientation="horizontal"
        className="w-[calc(100vw-5rem)] md:w-auto"
      >
        <TopPagesTable data={topPagesData} />
      </ScrollArea>
    </DashboardCard>
  );
}
