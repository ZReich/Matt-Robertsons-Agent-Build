import type { CalendarAction, CalendarState, Category, Event } from "../types";

export function calendarReducer(
  calendarState: CalendarState,
  action: CalendarAction
): CalendarState {
  switch (action.type) {
    case "add": {
      return {
        ...calendarState,
        events: [...calendarState.events, action.event as Event],
      };
    }

    case "update": {
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

    case "delete": {
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

      const index = tempSelectedCategories.indexOf(action.category as Category);

      if (index !== -1) {
        tempSelectedCategories.splice(index, 1);
      } else {
        tempSelectedCategories.push(action.category as Category);
      }

      const tempSelectedEvents = calendarState.events.filter((event) =>
        tempSelectedCategories.includes(
          event.extendedProps.category as Category
        )
      );

      return {
        ...calendarState,
        events: tempSelectedEvents,
        selectedCategories: tempSelectedCategories,
      };
    }

    case "selectAllCategories": {
      let tempSelectedCategories: Category[] = [
        "Personal",
        "Business",
        "Family",
        "Holiday",
        "Health",
        "Miscellaneous",
      ];
      let tempEvents = calendarState.events;

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

    default: {
      throw Error("Unknown action: " + action.type);
    }
  }
}
