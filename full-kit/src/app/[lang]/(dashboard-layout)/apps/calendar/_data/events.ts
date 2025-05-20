import type { EventType } from "../types"

export const eventsData: EventType[] = [
  {
    id: "1",
    title: "Team Meeting",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate())).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate())).toISOString(),
    extendedProps: {
      category: "Business",
      description: "Discuss project updates.",
    },
  },
  {
    id: "2",
    title: "Doctor Appointment",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    extendedProps: {
      category: "Health",
      description: "Annual check-up.",
    },
  },
  {
    id: "3",
    title: "Birthday Party",
    allDay: true,
    start: new Date(
      new Date().setDate(new Date().getDate() - 10)
    ).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
    extendedProps: {
      category: "Family",
      description: "Celebrating John’s birthday.",
    },
  },
  {
    id: "4",
    title: "Project Deadline",
    allDay: true,
    start: new Date(
      new Date().setDate(new Date().getDate() + 15)
    ).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
    extendedProps: {
      category: "Business",
      description: "Final submission for the project.",
    },
  },
  {
    id: "5",
    title: "Weekend Getaway",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
    extendedProps: {
      category: "Holiday",
      description: "Relaxing at the beach.",
    },
  },
  {
    id: "6",
    title: "Family Reunion",
    allDay: true,
    start: new Date(
      new Date().setDate(new Date().getDate() + 25)
    ).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() + 25)).toISOString(),
    extendedProps: {
      category: "Family",
      description: "Gathering with relatives.",
    },
  },
]
