import type { LocaleType } from "@/types";

import { Unauthorized401 } from "@/components/pages/unauthorized-401";

export default function Unauthorized401Pgae({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return <Unauthorized401 locale={params.lang} />;
}
