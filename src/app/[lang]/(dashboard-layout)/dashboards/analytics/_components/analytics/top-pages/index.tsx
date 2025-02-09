import { topPagesData } from "../../../_data/top-pages";

import { TopPagesTable } from "./top-pages-table";
import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { ScrollArea } from "@/components/ui/scroll-area";

export async function TopPages() {
  return (
    <DashboardCard title="Top Pages" period={topPagesData.period}>
      <ScrollArea
        orientation="horizontal"
        className="w-[calc(100vw-5rem)] md:w-auto"
      >
        <TopPagesTable data={topPagesData.pages} />
      </ScrollArea>
    </DashboardCard>
  );
}
