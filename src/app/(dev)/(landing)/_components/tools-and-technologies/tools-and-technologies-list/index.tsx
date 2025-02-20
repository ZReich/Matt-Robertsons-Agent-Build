import { toolsAndTechnologiesData } from "../../../_data/tools-and-technologies";

import { ToolsAndTechnologiesItem } from "./tools-and-technologies-item";

export function ToolsAndTechnologiesList() {
  return (
    <div className="grid grid-cols-2 place-items-center gap-4 md:grid-cols-6">
      {toolsAndTechnologiesData.map((item) => (
        <ToolsAndTechnologiesItem key={item.title} item={item} />
      ))}
    </div>
  );
}
