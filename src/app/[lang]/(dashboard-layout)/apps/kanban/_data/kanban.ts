import { ColumnType } from "../types";

export const kanbanData: ColumnType[] = [
  {
    id: "backlog",
    title: "Backlog",
    order: 0,
    tasks: [
      {
        id: "task-0",
        columnId: "backlog",
        order: 0,
        title: "Research Project",
        description: "Conduct initial research on market trends.",
        label: "Research",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/research-report.pdf",
            name: "Research Report",
            size: 1048576,
            type: "application/pdf",
          },
          {
            url: "/images/business-03.jpeg",
            name: "Market Trends Chart",
            size: 524288,
            type: "image/jpeg",
          },
        ],
        comments: [
          {
            id: "comment-0",
            userId: "member-0",
            text: "Let's start gathering data.",
            createdAt: new Date(),
          },
        ],
      },
      {
        id: "task-1",
        columnId: "backlog",
        order: 1,
        title: "Design Wireframe",
        description: "Create a wireframe for the new feature.",
        label: "Design",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/images/business-04.jpeg",
            name: "Wireframe v1",
            size: 262144,
            type: "image/jpeg",
          },
          {
            url: "/images/business-01.jpeg",
            name: "Wireframe v2",
            size: 307200,
            type: "image/jpeg",
          },
        ],
        comments: [
          {
            id: "comment-1",
            userId: "member-0",
            text: "We need to focus on user experience.",
            createdAt: new Date(),
          },
          {
            id: "comment-2",
            userId: "member-2",
            text: "Can we add more options for users?",
            createdAt: new Date(),
          },
        ],
      },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    order: 1,
    tasks: [
      {
        id: "task-3",
        columnId: "in-progress",
        order: 0,
        title: "Develop API",
        description: "Build the API for user authentication.",
        label: "Development",
        assigned: [
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/api-specs.pdf",
            name: "API Specifications",
            size: 2097152,
            type: "application/pdf",
          },
        ],
        comments: [
          {
            id: "comment-3",
            userId: "member-2",
            text: "I started on the endpoints.",
            createdAt: new Date(),
          },
          {
            id: "comment-4",
            userId: "member-3",
            text: "Let me know if you need help!",
            createdAt: new Date(),
          },
        ],
      },
      {
        id: "task-4",
        columnId: "in-progress",
        order: 1,
        title: "Update UI",
        description: "Revise the user interface for better UX.",
        label: "Design",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/images/business-01.jpeg",
            name: "UI Mockup",
            size: 716800,
            type: "image/jpeg",
          },
        ],
        comments: [
          {
            id: "comment-5",
            userId: "member-0",
            text: "What do you think about the new color scheme?",
            createdAt: new Date(),
          },
        ],
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    order: 2,
    tasks: [
      {
        id: "task-5",
        columnId: "done",
        order: 0,
        title: "Write Documentation",
        description: "Prepare the project documentation for release.",
        label: "Documentation",
        assigned: [
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/project-docs.pdf",
            name: "Project Documentation",
            size: 1572864,
            type: "application/pdf",
          },
        ],
        comments: [
          {
            id: "comment-6",
            userId: "member-2",
            text: "Documentation is complete!",
            createdAt: new Date(),
          },
          {
            id: "comment-7",
            userId: "member-3",
            text: "Looks good, ready for review.",
            createdAt: new Date(),
          },
        ],
      },
      {
        id: "task-6",
        columnId: "done",
        order: 1,
        title: "Fix Bugs",
        description: "Resolve all known bugs from the previous release.",
        label: "QA",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/bug-report.pdf",
            name: "Bug Report",
            size: 512000,
            type: "application/pdf",
          },
        ],
        comments: [
          {
            id: "comment-8",
            userId: "member-1",
            text: "All bugs have been fixed.",
            createdAt: new Date(),
          },
          {
            id: "comment-9",
            userId: "member-0",
            text: "Great teamwork!",
            createdAt: new Date(),
          },
        ],
      },
      {
        id: "task-7",
        columnId: "done",
        order: 2,
        title: "Launch Campaign",
        description: "Officially launch the marketing campaign.",
        label: "Marketing",
        assigned: [
          {
            id: "member-1",
            username: "jane.smith",
            name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-0",
            username: "john.doe",
            name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
        ],
        dueDate: new Date(),
        attachments: [
          {
            url: "/campaign-plan.pdf",
            name: "Campaign Plan",
            size: 1310720,
            type: "application/pdf",
          },
          {
            url: "/images/business-02.jpeg",
            name: "Campaign Plan",
            size: 1310720,
            type: "image/jpeg",
          },
        ],
        comments: [
          {
            id: "comment-10",
            userId: "member-1",
            text: "The campaign is live!",
            createdAt: new Date(),
          },
          {
            id: "comment-11",
            userId: "member-2",
            text: "Let’s monitor the response closely.",
            createdAt: new Date(),
          },
        ],
      },
    ],
  },
];
