import type { CalendarApi } from "@fullcalendar/core/index.js";

export interface CalendarContextType {
  calendarState: CalendarStateType;
  calendarApi: CalendarApi | null;
  setCalendarApi: (val: CalendarApi) => void;
  eventSidebarIsOpen: boolean;
  setEventSidebarIsOpen: (val: boolean) => void;
  handleAddEvent: (event: Omit<EventType, "id">) => void;
  handleUpdateEvent: (event: EventType) => void;
  handleDeleteEvent: (eventId: EventType["id"]) => void;
  handleSelectEvent: (event?: EventType) => void;
  handleSelectCategory: (category: CategoryType) => void;
  handleSelectAllCategories: (isSelectAllCategories: boolean) => void;
}

export type CategoryType =
  | "Business"
  | "Personal"
  | "Family"
  | "Holiday"
  | "Health"
  | "Miscellaneous";

export type EventType = {
  id: string;
  url?: string;
  title: string;
  allDay: boolean;
  end: Date | null;
  start: Date | null;
  extendedProps: {
    category: CategoryType;
    description?: string;
  };
};

export type CalendarStateType = {
  events: EventType[];
  selectedEvent?: EventType;
  selectedCategories: CategoryType[];
};

export type CalendarActionType = {
  type:
    | "addEvent"
    | "updateEvent"
    | "deleteEvent"
    | "selectEvent"
    | "selectCategory"
    | "selectAllCategories";
  event?: EventType;
  category?: CategoryType;
  eventId?: string;
  isSelectAllCategories?: boolean;
};
