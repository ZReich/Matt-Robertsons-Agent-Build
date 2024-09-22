import { Event } from "@/types";

export const events: Event[] = [
  {
    id: "1",
    title: "Team Meeting",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate())), // Tomorrow
    end: new Date(new Date().setDate(new Date().getDate())), // Same day
    extendedProps: {
      category: "Business",
      description: "Discuss project updates.",
    },
  },
  {
    id: "2",
    title: "Doctor Appointment",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() + 5)), // 5 days from now
    end: new Date(new Date().setDate(new Date().getDate() + 5)), // Same day
    extendedProps: {
      category: "Health",
      description: "Annual check-up.",
    },
  },
  {
    id: "3",
    title: "Birthday Party",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() - 10)), // 10 days from now
    end: new Date(new Date().setDate(new Date().getDate() - 10)), // Same day
    extendedProps: {
      category: "Family",
      description: "Celebrating John’s birthday.",
    },
  },
  {
    id: "4",
    title: "Project Deadline",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() + 15)), // 15 days from now
    end: new Date(new Date().setDate(new Date().getDate() + 15)), // Same day
    extendedProps: {
      category: "Business",
      description: "Final submission for the project.",
    },
  },
  {
    id: "5",
    title: "Weekend Getaway",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() - 5)), // 20 days from now
    end: new Date(new Date().setDate(new Date().getDate() - 3)), // 2 days
    extendedProps: {
      category: "Holiday",
      description: "Relaxing at the beach.",
    },
  },
  {
    id: "6",
    title: "Family Reunion",
    allDay: true,
    start: new Date(new Date().setDate(new Date().getDate() + 25)), // 25 days from now
    end: new Date(new Date().setDate(new Date().getDate() + 25)), // Same day
    extendedProps: {
      category: "Family",
      description: "Gathering with relatives.",
    },
  },
];
