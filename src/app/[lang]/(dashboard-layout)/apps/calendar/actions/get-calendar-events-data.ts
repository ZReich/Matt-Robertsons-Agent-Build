import { eventsData } from "../_data/events";

import { wait } from "@/lib/utils";

import type { EventType } from "../types";

export const getEventsData = async (): Promise<EventType[]> => {
  await wait(); // Simulate a network delay

  return eventsData;
};
