import { formatDistanceToNow as formatDistanceToNowFn } from "date-fns";

export function formatDistanceToNow(dateString: string) {
  return formatDistanceToNowFn(new Date(dateString), {
    addSuffix: true,
  }).replace("about", "");
}
