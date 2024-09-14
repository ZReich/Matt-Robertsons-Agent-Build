import {
  formatDistanceToNow as formatDistanceToNowFn,
  intervalToDuration,
} from "date-fns";

export function formatDistanceToNow(dateString: string) {
  return formatDistanceToNowFn(new Date(dateString), {
    addSuffix: true,
  }).replace("about", "");
}

export function formatDuration(milliseconds: number) {
  const duration = intervalToDuration({ start: 0, end: milliseconds });

  const hours = duration.hours ? `${duration.hours}h` : "";
  const minutes = duration.minutes ? `${duration.minutes}m` : "";
  const seconds = duration.seconds ? `${duration.seconds}s` : "";

  return `${hours} ${minutes} ${seconds}`.trim();
}
