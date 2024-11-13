import { eventsData } from "../_data/events";

import type { EventType } from "../types";

export const getEventsData = async (): Promise<EventType[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(eventsData);
    }, 250);
  });
};
