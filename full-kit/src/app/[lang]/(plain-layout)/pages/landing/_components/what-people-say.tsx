import { WhatPeopleSayCarousel } from "./what-people-say-carousel"

export function WhatPeopleSay() {
  return (
    <section id="features" className="container flex flex-col gap-8">
      <div className="mx-auto text-center">
        <h1 className="text-3xl font-semibold">What People Say</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          See why developers, designers, and founders love using our admin
          dashboard template to launch fast and scale with confidence.
        </p>
      </div>
      <WhatPeopleSayCarousel />
    </section>
  )
}
