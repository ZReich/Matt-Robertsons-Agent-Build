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
