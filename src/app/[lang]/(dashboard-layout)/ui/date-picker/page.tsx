import type { Metadata } from "next";

import { DefaultDatePicker } from "./_components/default-date-picker";
import { DateRangePicker } from "./_components/date-range-picker";
import { DatePickerWithPresets } from "./_components/date-picker-with-presets";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Date Picker",
};

export default function DatePickerPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultDatePicker />
      <DateRangePicker />
      <DatePickerWithPresets />
    </section>
  );
}
