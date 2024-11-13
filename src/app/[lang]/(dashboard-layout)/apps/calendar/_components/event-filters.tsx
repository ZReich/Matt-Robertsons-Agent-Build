import { Filter } from "lucide-react";

import { categoriesData } from "../_data/categories";

import { useCalendarContext } from "../hooks/calendar-context";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function EventFilters() {
  const { calendarState, handleSelectCategory, handleSelectAllCategories } =
    useCalendarContext();

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
            calendarState.selectedCategories.length === categoriesData.length
          }
          onCheckedChange={handleSelectAllCategories}
        >
          All
        </DropdownMenuCheckboxItem>
        {categoriesData.map((category) => (
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
