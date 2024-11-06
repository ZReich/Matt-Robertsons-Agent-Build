import { Locale } from "@/configs/i18n";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(fullName: string) {
  // Split the name by spaces
  const names = fullName.split(" ");
  // Extract the first letter of each name and convert it to uppercase
  const initials = names.map((name) => name.charAt(0).toUpperCase()).join("");
  return initials;
}

export function ensurePrefix(str: string, prefix: string) {
  return str.startsWith(prefix) ? str : `${prefix}${str}`;
}

export function withoutSuffix(str: string, suffix: string) {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

export function withoutPrefix(str: string, prefix: string) {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}

export function shuffleArray(array: any[]) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
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
