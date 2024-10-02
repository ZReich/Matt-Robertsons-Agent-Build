import type { ColumnType } from "../types";

const kanbanData: ColumnType[] = [
  {
    id: "backlog",
    title: "Backlog",
    order: 0,
    tasks: [
      {
        id: "task-0",
        column_id: "backlog",
        order: 0,
        title: "Research Project",
        description: "Conduct initial research on market trends.",
        label: "Research",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            full_name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            full_name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            full_name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            full_name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-0",
            text: "Let's start gathering data.",
            created_at: new Date(),
          },
        ],
      },
      {
        id: "task-1",
        column_id: "backlog",
        order: 1,
        title: "Design Wireframe",
        description: "Create a wireframe for the new feature.",
        label: "Design",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            full_name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            full_name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            full_name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-0",
            text: "We need to focus on user experience.",
            created_at: new Date(),
          },
          {
            id: "comment-2",
            user_id: "member-2",
            text: "Can we add more options for users?",
            created_at: new Date(),
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
        column_id: "in-progress",
        order: 0,
        title: "Develop API",
        description: "Build the API for user authentication.",
        label: "Development",
        assigned: [
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            full_name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-2",
            text: "I started on the endpoints.",
            created_at: new Date(),
          },
          {
            id: "comment-4",
            user_id: "member-3",
            text: "Let me know if you need help!",
            created_at: new Date(),
          },
        ],
      },
      {
        id: "task-4",
        column_id: "in-progress",
        order: 1,
        title: "Update UI",
        description: "Revise the user interface for better UX.",
        label: "Design",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            full_name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-0",
            text: "What do you think about the new color scheme?",
            created_at: new Date(),
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
        column_id: "done",
        order: 0,
        title: "Write Documentation",
        description: "Prepare the project documentation for release.",
        label: "Documentation",
        assigned: [
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            full_name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
          {
            id: "member-4",
            username: "tom.clark",
            full_name: "Tom Clark",
            avatar: "/images/avatars/05.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-2",
            text: "Documentation is complete!",
            created_at: new Date(),
          },
          {
            id: "comment-7",
            user_id: "member-3",
            text: "Looks good, ready for review.",
            created_at: new Date(),
          },
        ],
      },
      {
        id: "task-6",
        column_id: "done",
        order: 1,
        title: "Fix Bugs",
        description: "Resolve all known bugs from the previous release.",
        label: "QA",
        assigned: [
          {
            id: "member-0",
            username: "john.doe",
            full_name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
          {
            id: "member-1",
            username: "jane.smith",
            full_name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-3",
            username: "emily.davis",
            full_name: "Emily Davis",
            avatar: "/images/avatars/04.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-1",
            text: "All bugs have been fixed.",
            created_at: new Date(),
          },
          {
            id: "comment-9",
            user_id: "member-0",
            text: "Great teamwork!",
            created_at: new Date(),
          },
        ],
      },
      {
        id: "task-7",
        column_id: "done",
        order: 2,
        title: "Launch Campaign",
        description: "Officially launch the marketing campaign.",
        label: "Marketing",
        assigned: [
          {
            id: "member-1",
            username: "jane.smith",
            full_name: "Jane Smith",
            avatar: "/images/avatars/02.png",
          },
          {
            id: "member-2",
            username: "paul.johnson",
            full_name: "Paul Johnson",
            avatar: "/images/avatars/03.png",
          },
          {
            id: "member-0",
            username: "john.doe",
            full_name: "John Doe",
            avatar: "/images/avatars/01.png",
          },
        ],
        due_date: new Date(),
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
            user_id: "member-1",
            text: "The campaign is live!",
            created_at: new Date(),
          },
          {
            id: "comment-11",
            user_id: "member-2",
            text: "Let’s monitor the response closely.",
            created_at: new Date(),
          },
        ],
      },
    ],
  },
];

export const getKanbanData = async (): Promise<typeof kanbanData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(kanbanData);
    }, 1000);
  });
};
