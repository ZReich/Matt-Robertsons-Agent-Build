import type { ComponentProps } from "react"
import type { CardDemo } from "../_components/card-demo"

export const layoutsData: ComponentProps<typeof CardDemo>[] = [
  {
    title: "Vertical LTR Layout",
    href: "https://shadboard.vercel.app/en/dashboards/analytics?layout=vertical&radius=0.5&mode=system",
    imgSrc: "/images/misc/layout-ltr-vertical.jpg",
  },
  {
    title: "Horizontal LTR Layout",
    href: "https://shadboard.vercel.app/en/dashboards/analytics?layout=horizontal&radius=0.5&mode=system",
    imgSrc: "/images/misc/layout-ltr-horizontal.jpg",
  },
  {
    title: "Vertical RTL Layout",
    href: "https://shadboard.vercel.app/ar/dashboards/analytics?layout=vertical&radius=0.5&mode=system",
    imgSrc: "/images/misc/layout-rtl-vertical.jpg",
  },
  {
    title: "Horizontal RTL Layout",
    href: "https://shadboard.vercel.app/ar/dashboards/analytics?layout=horizontal&radius=0.5&mode=system",
    imgSrc: "/images/misc/layout-rtl-horizontal.jpg",
  },
  {
    title: "Vertical Dark Layout",
    href: "https://shadboard.vercel.app/en/dashboards/analytics?layout=vertical&radius=0.5&mode=dark",
    imgSrc: "/images/misc/layout-ltr-dark-vertical.jpg",
  },
  {
    title: "Horizontal Dark Layout",
    href: "https://shadboard.vercel.app/en/dashboards/analytics?layout=horizontal&radius=0.5&mode=dark",
    imgSrc: "/images/misc/layout-ltr-dark-horizontal.jpg",
  },
  {
    title: "Vertical Rounded Layout",
    href: "https://shadboard.vercel.app/dashboards/analytics?layout=vertical&radius=1.0&mode=system",
    imgSrc: "/images/misc/layout-ltr-rounded-vertical.jpg",
  },
  {
    title: "Horizontal Rounded Layout",
    href: "https://shadboard.vercel.app/dashboards/analytics?layout=horizontal&radius=1.0&mode=system",
    imgSrc: "/images/misc/layout-ltr-rounded-horizontal.jpg",
  },
]
