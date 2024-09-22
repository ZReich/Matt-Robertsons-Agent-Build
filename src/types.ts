import { LucideIcon } from "lucide-react";

export type Layout = "vertical" | "horizontal";

export type Mode = "light" | "dark" | "system";

export type Orientation = "vertical" | "horizontal";

export type Direction = "ltr" | "rtl";

interface IconProps extends React.SVGAttributes<SVGElement> {
  children?: never;
  color?: string;
}
export type Icon = React.ComponentType<IconProps> | LucideIcon;

export function ratingToPercentage(rating: number, maxRating: number) {
  return (rating / maxRating) * 100;
}

export type Category =
  | "Business"
  | "Personal"
  | "Family"
  | "Holiday"
  | "Health"
  | "Miscellaneous";

export type Event = {
  id: string;
  url?: string;
  title: string;
  allDay: boolean;
  end: Date | null;
  start: Date | null;
  extendedProps: {
    category: Category;
    description?: string;
  };
};

export type CalendarState = {
  events: Event[];
  selectedEvent?: Event;
  selectedCategories: Category[];
};

export type CalendarAction = {
  type:
    | "add"
    | "update"
    | "delete"
    | "selectEvent"
    | "selectCategory"
    | "selectAllCategories";
  event?: Event;
  category?: Category;
  eventId?: string;
  isSelectAllCategories?: boolean;
};
