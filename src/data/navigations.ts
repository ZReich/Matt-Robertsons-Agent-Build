import type { NavigationGroupType } from "@/types";

export const navigationsData: NavigationGroupType[] = [
  {
    title: "Dashboards",
    items: [
      {
        title: "Analytics",
        href: "/dashboards/analytics",
        iconName: "ChartPie",
      },
      {
        title: "CRM",
        href: "/dashboards/crm",
        iconName: "ChartBar",
      },
      {
        title: "eCommerce",
        href: "/dashboards/ecommerce",
        iconName: "ShoppingCart",
      },
    ],
  },
  {
    title: "Pages",
    items: [
      {
        title: "Landing",
        href: "#",
        label: "Soon",
        iconName: "LayoutTemplate",
      },
      {
        title: "Pricing",
        href: "/pages/pricing",
        iconName: "CircleDollarSign",
      },
      {
        title: "Payment",
        href: "/pages/payment",
        iconName: "CreditCard",
      },
      {
        title: "Help Center",
        href: "#",
        label: "Soon",
        iconName: "Headset",
      },
      {
        title: "Not Found 404",
        href: "/pages/not-found-404",
        iconName: "Frown",
      },
      {
        title: "Unauthorized 401",
        href: "/pages/unauthorized-401",
        iconName: "Lock",
      },
      {
        title: "Maintenance",
        href: "/pages/maintenance",
        iconName: "Wrench",
      },
      {
        title: "Coming Soon",
        href: "/pages/coming-soon",
        iconName: "Clock",
      },
      {
        title: "Settings",
        href: "/pages/account/settings",
        iconName: "UserRoundCog",
      },
      {
        title: "Profile",
        href: "/pages/account/profile",
        label: "Soon",
        iconName: "User",
      },
    ],
  },
  {
    title: "Apps",
    items: [
      {
        title: "Email",
        href: "/apps/email",
        iconName: "AtSign",
      },
      {
        title: "Chat",
        href: "/apps/chat",
        iconName: "MessageCircle",
      },
      {
        title: "Calendar",
        href: "/apps/calendar",
        iconName: "Calendar",
      },
      {
        title: "Kanban",
        href: "/apps/kanban",
        iconName: "Grid2x2",
      },
      {
        title: "Todo",
        href: "#",
        label: "Soon",
        iconName: "ListTodo",
      },
    ],
  },
  {
    title: "Authentication",
    items: [
      {
        title: "Forgot Password",
        href: "/auth/forgot-password",
        iconName: "RotateCw",
      },
      {
        title: "New Password",
        href: "/auth/new-password",
        iconName: "RefreshCw",
      },
      {
        title: "Verify Email",
        href: "/auth/verify-email",
        iconName: "MailCheck",
      },
      {
        title: "Register",
        href: "/auth/register",
        iconName: "FilePen",
      },
      {
        title: "Sign In",
        href: "/auth/sign-in",
        iconName: "LogIn",
      },
    ],
  },
  {
    title: "Components",
    items: [
      {
        title: "Forms",
        href: "/forms",
        iconName: "TextCursorInput",
        items: [
          {
            title: "Basic Inputs",
            href: "/forms/basic-inputs",
            iconName: "Type",
          },
          {
            title: "File Dropzone",
            href: "/forms/file-dropzone",
            iconName: "Upload",
          },
          {
            title: "Form Layouts",
            href: "/forms/form-layouts",
            iconName: "BoxSelect",
          },
          {
            title: "Pickers",
            href: "/forms/pickers",
            iconName: "Calendar",
          },
          {
            title: "Select and Tags",
            href: "/forms/select-and-tags",
            iconName: "ListFilter",
          },
        ],
      },
      {
        title: "Tables",
        href: "/tables",
        iconName: "Table",
      },
      {
        title: "Charts",
        href: "/charts",
        iconName: "ChartArea",
        items: [
          {
            title: "Area Charts",
            href: "/charts/area-charts",
            iconName: "TrendingUp",
          },
          {
            title: "Bar Charts",
            href: "/charts/bar-charts",
            iconName: "ChartBar",
          },
          {
            title: "Composed Charts",
            href: "/charts/composed-charts",
            iconName: "ChartBarStacked",
          },
          {
            title: "Line Charts",
            href: "/charts/line-charts",
            iconName: "ChartLine",
          },
          {
            title: "Pie Charts",
            href: "/charts/pie-charts",
            iconName: "ChartPie",
          },
          {
            title: "Radar Charts",
            href: "/charts/radar-charts",
            iconName: "Radar",
          },
          {
            title: "Radial Bar Charts",
            href: "/charts/radial-bar-charts",
            iconName: "Radar",
          },
          {
            title: "Scatter Charts",
            href: "/charts/scatter-charts",
            iconName: "ChartScatter",
          },
          {
            title: "Treemap Charts",
            href: "/charts/treemap-charts",
            iconName: "TableCellsMerge",
          },
        ],
      },
      {
        title: "Icons",
        href: "/icons",
        iconName: "Smile",
        items: [
          {
            title: "Lucide",
            href: "/icons/lucide",
            iconName: "Feather",
          },
          {
            title: "React Icons",
            href: "/icons/react-icons",
            iconName: "Package",
          },
        ],
      },
      {
        title: "Cards",
        href: "/cards",
        iconName: "CreditCard",
        items: [
          {
            title: "Advanced",
            href: "/cards/advanced",
            iconName: "Zap",
          },
          {
            title: "Analytics",
            href: "/cards/analytics",
            iconName: "ChartBar",
          },
          {
            title: "Basic",
            href: "/cards/basic",
            iconName: "SquareStack",
          },
          {
            title: "Statistics",
            href: "/cards/statistics",
            iconName: "TrendingUp",
          },
        ],
      },
      {
        title: "UI",
        href: "/ui",
        iconName: "LayoutGrid",
        items: [
          {
            title: "Accordion",
            href: "/ui/accordion",
            iconName: "AlignJustify",
          },
          {
            title: "Alert",
            href: "/ui/alert",
            iconName: "TriangleAlert",
          },
          {
            title: "Alert Dialog",
            href: "/ui/alert-dialog",
            iconName: "CircleAlert",
          },
          {
            title: "Aspect Ratio",
            href: "/ui/aspect-ratio",
            iconName: "RectangleHorizontal",
          },
          {
            title: "Avatar",
            href: "/ui/avatar",
            iconName: "User",
          },
          {
            title: "Badge",
            href: "/ui/badge",
            iconName: "Badge",
          },
          {
            title: "Breadcrumb",
            href: "/ui/breadcrumb",
            iconName: "ChevronRight",
          },
          {
            title: "Button",
            href: "/ui/button",
            iconName: "Square",
          },
          {
            title: "Calendar",
            href: "/ui/calendar",
            iconName: "Calendar",
          },
          {
            title: "Card",
            href: "/ui/card",
            iconName: "CreditCard",
          },
          {
            title: "Carousel",
            href: "/ui/carousel",
            iconName: "Images",
          },
          {
            title: "Checkbox",
            href: "/ui/checkbox",
            iconName: "SquareCheck",
          },
          {
            title: "Collapsible",
            href: "/ui/collapsible",
            iconName: "ChevronDown",
          },
          {
            title: "Combobox",
            href: "/ui/combobox",
            iconName: "List",
          },
          {
            title: "Command",
            href: "/ui/command",
            iconName: "Terminal",
          },
          {
            title: "Context Menu",
            href: "/ui/context-menu",
            iconName: "Menu",
          },
          {
            title: "Date Picker",
            href: "/ui/date-picker",
            iconName: "CalendarDays",
          },
          {
            title: "Dialog",
            href: "/ui/dialog",
            iconName: "MessageSquare",
          },
          {
            title: "Drawer",
            href: "/ui/drawer",
            iconName: "PanelRightOpen",
          },
          {
            title: "Dropdown Menu",
            href: "/ui/dropdown-menu",
            iconName: "ChevronDown",
          },
          {
            title: "Form",
            href: "/ui/form",
            iconName: "TextCursorInput",
          },
          {
            title: "Hover Card",
            href: "/ui/hover-card",
            iconName: "CreditCard",
          },
          {
            title: "Input",
            href: "/ui/input",
            iconName: "TextCursorInput",
          },
          {
            title: "Input OTP",
            href: "/ui/input-otp",
            iconName: "Hash",
          },
          {
            title: "Label",
            href: "/ui/label",
            iconName: "Tag",
          },
          {
            title: "Menubar",
            href: "/ui/menubar",
            iconName: "Menu",
          },
          {
            title: "Navigation Menu",
            href: "/ui/navigation-menu",
            iconName: "Navigation",
          },
          {
            title: "Pagination",
            href: "/ui/pagination",
            iconName: "Ellipsis",
          },
          {
            title: "Popover",
            href: "/ui/popover",
            iconName: "MessageCircle",
          },
          {
            title: "Progress",
            href: "/ui/progress",
            iconName: "Loader",
          },
          {
            title: "Radio Group",
            href: "/ui/radio-group",
            iconName: "Radio",
          },
          {
            title: "Resizable",
            href: "/ui/resizable",
            iconName: "Move",
          },
          {
            title: "Scroll Area",
            href: "/ui/scroll-area",
            iconName: "ScrollText",
          },
          {
            title: "Select",
            href: "/ui/select",
            iconName: "ChevronDown",
          },
          {
            title: "Separator",
            href: "/ui/separator",
            iconName: "Minus",
          },
          {
            title: "Sheet",
            href: "/ui/sheet",
            iconName: "PanelLeft",
          },
          {
            title: "Skeleton",
            href: "/ui/skeleton",
            iconName: "Loader",
          },
          {
            title: "Slider",
            href: "/ui/slider",
            iconName: "SlidersHorizontal",
          },
          {
            title: "Snackbar",
            href: "/ui/snackbar",
            iconName: "MessageSquare",
          },
          {
            title: "Switch",
            href: "/ui/switch",
            iconName: "ToggleLeft",
          },
          {
            title: "Table",
            href: "/ui/table",
            iconName: "Table",
          },
          {
            title: "Tabs",
            href: "/ui/tabs",
            iconName: "AppWindowMac",
          },
          {
            title: "Textarea",
            href: "/ui/textarea",
            iconName: "AlignLeft",
          },
          {
            title: "Toast",
            href: "/ui/toast",
            iconName: "Bell",
          },
          {
            title: "Toggle",
            href: "/ui/toggle",
            iconName: "ToggleRight",
          },
          {
            title: "Toggle Group",
            href: "/ui/toggle-group",
            iconName: "ToggleLeft",
          },
          {
            title: "Tooltip",
            href: "/ui/tooltip",
            iconName: "CircleHelp",
          },
        ],
      },
      {
        title: "Extended UI",
        href: "/extended-ui",
        iconName: "LayoutDashboard",
        items: [
          {
            title: "Avatar Stack",
            href: "/extended-ui/avatar-stack",
            iconName: "Users",
          },
          {
            title: "File Dropzone",
            href: "/extended-ui/file-dropzone",
            iconName: "Upload",
          },
          {
            title: "Input File",
            href: "/extended-ui/input-file",
            iconName: "File",
          },
          {
            title: "Input Group",
            href: "/extended-ui/input-group",
            iconName: "Group",
          },
          {
            title: "Input Phone",
            href: "/extended-ui/input-phone",
            iconName: "Phone",
          },
          {
            title: "Input Spin",
            href: "/extended-ui/input-spin",
            iconName: "RotateCw",
          },
          {
            title: "Keyboard",
            href: "/extended-ui/keyboard",
            iconName: "Keyboard",
          },
          {
            title: "Ratings",
            href: "/extended-ui/ratings",
            iconName: "Star",
          },
          {
            title: "Separator with Text",
            href: "/extended-ui/separator-with-text",
            iconName: "SeparatorHorizontal",
          },
          {
            title: "Show More Text",
            href: "/extended-ui/show-more-text",
            iconName: "Text",
          },
          {
            title: "Tags Input",
            href: "/extended-ui/tags-input",
            iconName: "Tags",
          },
          {
            title: "Timeline",
            href: "/extended-ui/timeline",
            iconName: "ChartNoAxesGantt",
          },
        ],
      },
    ],
  },
];
