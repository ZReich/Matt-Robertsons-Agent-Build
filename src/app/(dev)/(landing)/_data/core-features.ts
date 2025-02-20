import {
  Accessibility,
  BookCheck,
  Brain,
  Component,
  Languages,
  MonitorSmartphone,
  PanelsTopLeft,
  PencilRuler,
  Shield,
} from "lucide-react";
import { SiRadixui, SiNextdotjs, SiReact, SiTailwindcss } from "react-icons/si";

import type { CoreFeatureType } from "../types";

export const coreFeaturesData: CoreFeatureType[] = [
  {
    title: "React 18",
    description:
      "Built using React 18 for enhanced performance, concurrency, and developer experience.",
    icon: SiReact,
  },
  {
    title: "Next.js 14",
    description:
      "Powered by Next.js 14, ensuring server-side rendering, SEO optimization, and app router support.",
    icon: SiNextdotjs,
  },
  {
    title: "Tailwind CSS",
    description:
      "Styled with Tailwind CSS, offering a utility-first approach for fast and responsive UI design.",
    icon: SiTailwindcss,
  },
  {
    title: "Radix UI",
    description:
      "Uses Radix UI for high-quality, accessible, and unstyled components.",
    icon: SiRadixui,
  },
  {
    title: "Internationalization (I18n)",
    description:
      "Built-in support for multiple languages, making it easy to expand your app globally.",
    icon: Languages,
  },
  {
    title: "Authentication",
    description: "Integrated user authentication and session management.",
    icon: Shield,
  },
  {
    title: "Customizer",
    description:
      "A tool for dynamically changing the style and colors of the dashboard. It’s perfect for previewing and selecting preferred themes.",
    icon: PencilRuler,
  },
  {
    title: "Content Rich",
    description:
      "Includes pre-built apps and pages, along with reusable components.",
    icon: Component,
  },
  {
    title: "Accessible",
    description:
      "Designed with accessibility in mind, ensuring usability for all users.",
    icon: Accessibility,
  },
  {
    title: "Pre-Made Layouts",
    description:
      "Offers ready-to-use layouts for dashboards, profiles, and other essential pages.",
    icon: PanelsTopLeft,
  },
  {
    title: "Responsive",
    description:
      "Fully responsive design, adapting seamlessly to different screen sizes.",
    icon: MonitorSmartphone,
  },
  {
    title: "Learning Resource",
    description:
      "Explore advanced web development approaches to build scalable and maintainable applications.",
    icon: Brain,
  },
  {
    title: "Well-Documented",
    description:
      "Comprehensive documentation for easy integration and customization.",
    icon: BookCheck,
  },
];
