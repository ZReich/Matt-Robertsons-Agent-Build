import { Filter } from "lucide-react";

import { categories } from "@/constants";

import { CalendarState, Category } from "@/types";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface EventFiltersProps {
  calendarState: CalendarState;
  handleSelectCategory: (category: Category) => void;
  handleSelectAllCategories: (isSelectAll: boolean) => void;
}

export function EventFilters({
  calendarState,
  handleSelectCategory,
  handleSelectAllCategories,
}: EventFiltersProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="size-4" />
          <span className="sr-only">Event Filters</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Event Filters</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          className="cursor-pointer"
          checked={
            calendarState.selectedCategories.length === categories.length
          }
          onCheckedChange={handleSelectAllCategories}
        >
          All
        </DropdownMenuCheckboxItem>
        {categories.map((category) => (
          <DropdownMenuCheckboxItem
            key={category}
            className="cursor-pointer"
            checked={calendarState.selectedCategories.includes(category)}
            onCheckedChange={() => handleSelectCategory(category)}
          >
            {category}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
