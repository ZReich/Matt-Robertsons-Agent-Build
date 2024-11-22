import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeProjectsData } from "../../_data/active-projects";
import { ActiveProjectsCarousel } from "./active-prijects-carousel";

export function ActiveProjects() {
  return (
    <article>
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="px-[4.5rem]">
          <ActiveProjectsCarousel data={activeProjectsData} />
        </CardContent>
      </Card>
    </article>
  );
}
