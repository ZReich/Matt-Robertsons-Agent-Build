import { invoicesData } from "../../_data/invoices";

import { InvoicesTable } from "./invoices-table";

export function Invoices() {
  return (
    <article className="col-span-2">
      <InvoicesTable invoices={invoicesData} />
    </article>
  );
}
