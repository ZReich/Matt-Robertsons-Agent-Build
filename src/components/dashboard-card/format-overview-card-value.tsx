import { formatCurrency, formatPercent, formatDuration } from "@/lib/utils";

import type { FormatStyleType } from "@/types";

export function formatOverviewCardValue(
  value: number,
  formatStyle: FormatStyleType
): string | number {
  switch (formatStyle) {
    case "percent":
      return formatPercent(value);
    case "duration":
      return formatDuration(value);
    case "currency":
      return formatCurrency(value);
    default:
      return value.toLocaleString();
  }
}
