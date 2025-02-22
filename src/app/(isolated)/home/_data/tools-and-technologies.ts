import {
  Calendar,
  ChartLine,
  CircleEllipsis,
  Shield,
  TreePalm,
} from "lucide-react";
import {
  SiRadixui,
  SiReacthookform,
  SiNextdotjs,
  SiReact,
  SiShadcnui,
  SiLucide,
  SiTailwindcss,
  SiZod,
} from "react-icons/si";
import { DiAtom } from "react-icons/di";

import type { ToolAndTechnologieType } from "../types";

export const toolsAndTechnologiesData: ToolAndTechnologieType[] = [
  {
    title: "Radix UI",
    href: "https://www.radix-ui.com/primitives",
    icon: SiRadixui,
  },
  {
    title: "React Hook Form",
    href: "https://react-hook-form.com/",
    icon: SiReacthookform,
  },
  {
    title: "Recharts",
    href: "https://recharts.org/",
    icon: ChartLine,
  },
  {
    title: "TanStack Table",
    href: "https://tanstack.com/table/latest",
    icon: TreePalm,
  },
  {
    title: "Next.js 14",
    href: "https://nextjs.org/",
    icon: SiNextdotjs,
  },
  {
    title: "React 18",
    href: "https://react.dev/",
    icon: SiReact,
  },
  {
    title: "NextAuth.js",
    href: "https://next-auth.js.org/",
    icon: Shield,
  },
  {
    title: "shadcn/ui",
    href: "https://ui.shadcn.com/",
    icon: SiShadcnui,
  },
  {
    title: "Embla Carousel",
    href: "https://www.embla-carousel.com/",
    icon: DiAtom,
  },
  {
    title: "Lucide",
    href: "https://lucide.dev/",
    icon: SiLucide,
  },
  {
    title: "React Icons",
    href: "https://react-icons.github.io/react-icons/",
    icon: SiReact,
  },
  {
    title: "Tailwind CSS",
    href: "https://tailwindcss.com/",
    icon: SiTailwindcss,
  },
  {
    title: "Zod",
    href: "https://zod.dev/",
    icon: SiZod,
  },
  {
    title: "FullCalendar",
    href: "https://fullcalendar.io/",
    icon: Calendar,
  },
  {
    title: "More",
    href: "https://shadboard.vercel.app/docs/miscellaneous/credits",
    icon: CircleEllipsis,
  },
];
