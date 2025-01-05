import { topPagesData } from "../../../_data/top-pages";

import { TopPagesTable } from "./top-pages-table";
import { DashboardCard } from "@/components/dashboard-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export async function TopPages() {
  return (
    <DashboardCard title="Top Pages" period={topPagesData.period}>
      <ScrollArea
        orientation="horizontal"
        className="h-96 w-[calc(100vw-5rem)] md:w-auto"
      >
        <TopPagesTable data={topPagesData.pages} />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </DashboardCard>
  );
}
