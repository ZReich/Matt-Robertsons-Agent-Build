import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, intervalToDuration } from "date-fns";
import { z } from "zod";

import type { LocaleType, FormatStyleType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(fullName: string) {
  if (fullName.length === 0) return "";

  // Split the name by spaces
  const names = fullName.split(" ");
  // Extract the first letter of each name and convert it to uppercase
  const initials = names.map((name) => name.charAt(0).toUpperCase()).join("");

  return initials;
}

export const isEven = (num: number) => num % 2 === 0;

export const getCreditCardBrandName = (number: string) => {
  const re = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
  };

  for (const [type, regex] of Object.entries(re)) {
    if (regex.test(number)) return type;
  }
  return "unknown";
};

export function remToPx(rem: number) {
  // Get the root font size (default is 16px if not set otherwise)
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );
  return rem * rootFontSize;
}

export function isUrl(text: string) {
  return z.string().url().safeParse(text).success;
}

export const isActivePathname = (
  basePathname: string,
  currentPathname: string
) => {
  if (typeof basePathname !== "string" || typeof currentPathname !== "string") {
    throw new Error("Both basePathname and currentPathname must be strings");
  }

  const regex = new RegExp(`^${basePathname}(?:/|$)`);
  return regex.test(currentPathname);
};

export function formatFileSize(bytes: number, decimals: number = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1000; // Use 1024 for binary
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatFileType(type: string) {
  return type.slice(0, type.lastIndexOf("/"));
}

export function ratingToPercentage(rating: number, maxRating: number) {
  return (rating / maxRating) * 100;
}

export function formatCurrency(
  value: number,
  locales: LocaleType = "en",
  currency: string = "USD"
) {
  return new Intl.NumberFormat(locales, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, locales: LocaleType = "en") {
  return new Intl.NumberFormat(locales, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | number | Date) {
  return format(value, "PP");
}

export function formatDateWithTime(value: string | number | Date) {
  return format(value, "PP hh:mm a");
}

export function formatDateShort(value: string | number | Date) {
  return format(value, "MMM dd");
}

export function formatDuration(value: string | number | Date) {
  const duration = intervalToDuration({ start: 0, end: value });

  const hours = duration.hours ? `${duration.hours}h` : "";
  const minutes = duration.minutes ? `${duration.minutes}m` : "";
  const seconds = duration.seconds ? `${duration.seconds}s` : "";

  return `${hours} ${minutes} ${seconds}`.trim();
}

export function formatDistance(value: string | number | Date) {
  const distance = formatDistanceToNow(value, { addSuffix: true });

  const replacements: Record<string, string> = {
    minute: "min",
    minutes: "mins",
    hour: "hr",
    hours: "hrs",
    day: "day",
    days: "days",
    month: "month",
    months: "months",
    year: "year",
    years: "years",
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

export function timeToDate(timeString: string, baseDate = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(timeString)) {
    throw new Error("Invalid time format. Use 'HH:mm'.");
  }

  const [hours, minutes] = timeString.split(":").map(Number);
  const date = new Date(baseDate); // Clone base date

  date.setHours(hours, minutes, 0, 0); // Set hours and minutes, reset seconds & milliseconds

  return date;
}

export function camelCaseToTitleCase(camelCaseStr: string) {
  const titleCaseStr = camelCaseStr
    .replace(/([A-Z])/g, " $1") // Insert space before uppercase letters
    .replace(/^./, (char) => char.toUpperCase()); // Capitalize the first letter

  return titleCaseStr;
}

export function titleCaseToCamelCase(titleCaseStr: string) {
  const camelCaseStr = titleCaseStr
    .toLowerCase() // Convert the entire string to lowercase first
    .replace(/\s+(.)/g, (_, char) => char.toUpperCase()); // Remove spaces and capitalize the following character

  return camelCaseStr;
}

export function ensurePrefix(value: string, prefix: string) {
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

export function ensureSuffix(value: string, suffix: string) {
  return value.endsWith(suffix) ? value : `${value}${suffix}`;
}

export function withoutSuffix(value: string, suffix: string) {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

export function withoutPrefix(value: string, prefix: string) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export const ensureRedirectPathname = (
  currentPathname: string,
  redirectPathname: string
): string => {
  const searchParams = new URLSearchParams({
    redirectTo: withoutSuffix(redirectPathname, "/"),
  });

  return ensureSuffix(currentPathname, "?" + searchParams);
};

export function isNonNegative(num: number) {
  return num >= 0;
}

export function getDiscountedPrice(
  price: number,
  discountRate: number,
  isAnnual: boolean = false
) {
  if (isAnnual) {
    // Apply discount to the annual price
    const annualPrice = price * 12;
    const discountedAnnualPrice = annualPrice * (1 - discountRate);

    // Calculate the equivalent monthly price after the discount
    const monthlyEquivalentPrice = discountedAnnualPrice / 12;
    return monthlyEquivalentPrice;
  } else {
    // Apply discount directly to the monthly price
    const discountedMonthlyPrice = price * (1 - discountRate);
    return discountedMonthlyPrice;
  }
}

export function isBeforeToday(date: Date) {
  // Get the start of today
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  // Compare the dates
  return date < startOfToday;
}

export function formatUnreadCount(unreadCount: number) {
  // If the unread count is 100 or more, display "+99"; otherwise, display the actual unread count.
  return unreadCount >= 100 ? "+99" : unreadCount;
}

export function wait(ms: number = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Retrieve the dictionary value safely
export const getDictionaryValue = (
  key: string,
  section: Record<string, unknown>
) => {
  const value = section[key];

  if (typeof value !== "string") {
    throw new Error(`Invalid dictionary value for key: ${key}`);
  }

  return value;
};
