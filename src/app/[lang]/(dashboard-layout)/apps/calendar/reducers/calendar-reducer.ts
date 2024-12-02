import { CATEGORIES } from "../constants";

import type {
  CalendarActionType,
  CalendarStateType,
  CategoryType,
  EventType,
} from "../types";

export function CalendarReducer(
  calendarState: CalendarStateType,
  action: CalendarActionType
): CalendarStateType {
  switch (action.type) {
    case "addEvent": {
      return {
        ...calendarState,
        events: [...calendarState.events, action.event as EventType],
      };
    }

    case "updateEvent": {
      const events = calendarState.events.map((event) => {
        if (event.id === action.event?.id) {
          return action.event;
        } else {
          return event;
        }
      });

      return {
        ...calendarState,
        events,
      };
    }

    case "deleteEvent": {
      const events = calendarState.events.filter(
        (event) => event.id !== action.eventId
      );

      return {
        ...calendarState,
        events,
      };
    }

    case "selectEvent": {
      return { ...calendarState, selectedEvent: action.event };
    }

    case "selectCategory": {
      const tempSelectedCategories = [...calendarState.selectedCategories];

      const index = tempSelectedCategories.indexOf(
        action.category as CategoryType
      );

      if (index !== -1) {
        tempSelectedCategories.splice(index, 1);
      } else {
        tempSelectedCategories.push(action.category as CategoryType);
      }

      const tempSelectedEvents = calendarState.initalEvents.filter((event) =>
        tempSelectedCategories.includes(
          event.extendedProps.category as CategoryType
        )
      );

      return {
        ...calendarState,
        events: tempSelectedEvents,
        selectedCategories: tempSelectedCategories,
      };
    }

    case "selectAllCategories": {
      let tempSelectedCategories = CATEGORIES;
      let tempEvents = calendarState.initalEvents;

      if (!action.isSelectAllCategories) {
        tempSelectedCategories = [];
        tempEvents = [];
      }

      return {
        ...calendarState,
        events: tempEvents,
        selectedCategories: tempSelectedCategories,
      };
    }
  }
}
