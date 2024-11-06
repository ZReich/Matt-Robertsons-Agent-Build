import {
  formatDistanceToNow as formatDistanceToNowFn,
  intervalToDuration,
} from "date-fns";

export function formatDistanceToNow(date: number | Date) {
  const distance = formatDistanceToNowFn(date, { addSuffix: true });

  const replacements: Record<string, string> = {
    minute: "min",
    minutes: "mins",
    hour: "hr",
    hours: "hrs",
    day: "day",
    days: "days",
    month: "mo",
    months: "mos",
    year: "yr",
    years: "yrs",
  };

  if (distance === "less than a minute ago") {
    return "just now";
  }

  // Replace phrases based on the mapping
  return distance
    .replace(
      /less than a minute|minute|minutes|hour|hours|day|days|month|months|year|years/g,
      (match) => replacements[match]
    )
    .replace(/\b(over|almost|about)\b/g, "");
}

export function formatDuration(milliseconds: number) {
  const duration = intervalToDuration({ start: 0, end: milliseconds });

  const hours = duration.hours ? `${duration.hours}h` : "";
  const minutes = duration.minutes ? `${duration.minutes}m` : "";
  const seconds = duration.seconds ? `${duration.seconds}s` : "";

  return `${hours} ${minutes} ${seconds}`.trim();
}
