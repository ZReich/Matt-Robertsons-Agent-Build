import type { LocaleType } from "@/configs/i18n";

import { Unauthorized401 } from "./_components/unauthorized-401";

export default function Unauthorized401Pgae({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return <Unauthorized401 locale={params.lang} />;
}
