import type { EmailType } from "../types";

export const emailsData: EmailType[] = [
  {
    id: "1",
    sender: {
      id: "1",
      name: "Tommy Sicilia",
      avatar: "/images/avatars/01.png",
      email: "tommy.sicilia@example.com",
      status: "Active",
    },
    subject: "How to Succeed with Your Shopify Store",
    content: `Hi, Tommy here!

I wanted to share some tips and strategies that have helped me scale my Shopify store. First and foremost, you need to ensure a user-friendly experience. Keep your navigation simple, and don't forget to optimize your checkout process.

Another key point is product photos. High-quality, clear images will make a huge difference in conversion rates. I’ll send more tips soon. Let me know if you have any questions or need further advice.

Best,  
Tommy`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-07T10:46:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "2",
    sender: {
      id: "2",
      name: "Tressa Gass",
      avatar: "/images/avatars/02.png",
      email: "tressa.gass@example.com",
      status: "Inactive",
    },
    subject: "Please find attached the latest Company Report",
    content: `Dear Team,

Attached you will find the most recent company report. Please review the financial figures and the updated metrics, and let me know if you have any questions.

Your feedback is crucial as we plan for the next quarter. Also, we’ll need to discuss the projections for Q1 during our next meeting. Let’s ensure everything is on track before we proceed.

Thanks,  
Tressa`,
    read: true,
    starred: true,
    createdAt: new Date("2024-11-07T10:55:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "3",
    sender: {
      id: "3",
      name: "Louetta Esses",
      avatar: "/images/avatars/03.png",
      email: "louetta.esses@example.com",
      status: "Active",
    },
    subject: "Update Can Change Your Personal Life",
    content: `Hi, it's Louetta.

I wanted to share some recent updates that have greatly impacted my personal life. Focusing on mental wellness has made a huge difference in how I approach my day. I've started using time management apps that have boosted my productivity and helped me create healthier work-life boundaries.

I highly recommend giving them a try! I'll follow up soon with more tips.

Best regards,  
Louetta`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-07T12:04:00Z"),
    label: "personal",
    isDraft: true,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: true,
  },
  {
    id: "4",
    sender: {
      id: "4",
      name: "Mack Johnson",
      email: "mack.johnson@example.com",
      status: "Active",
    },
    subject: "Weekly Team Meeting Agenda",
    content: `Hey everyone,

I just wanted to remind you all about the weekly team meeting tomorrow at 10:00 AM. The agenda includes project updates, upcoming deadlines, and an open floor for any concerns you may have. Please make sure you're prepared to discuss your progress.

Looking forward to seeing you all there. Feel free to reach out if you need anything before the meeting.

Cheers,  
Mack`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-07T14:30:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: true,
    isDeleted: false,
  },
  {
    id: "5",
    sender: {
      id: "5",
      name: "Sarah Lee",
      email: "sarah.lee@example.com",
      status: "Inactive",
    },
    subject: "New Product Launch Details",
    content: `Hi Team,

Exciting news! We are launching a new product next week, and I need all hands on deck to ensure a smooth rollout. I'll be sharing the product details and marketing plans in tomorrow's meeting. 

Please come prepared with any questions or suggestions you may have. We're all counting on your expertise to make this a success. 

Cheers,  
Sarah`,
    read: true,
    starred: true,
    createdAt: new Date("2024-11-07T16:15:00Z"),
    label: "important",
    isDraft: false,
    isSent: true,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "6",
    sender: {
      id: "6",
      name: "David Monroe",
      email: "david.monroe@example.com",
      status: "Active",
    },
    subject: "Holiday Office Hours",
    content: `Hello all,

I wanted to give you a heads-up regarding our office schedule for the upcoming holiday season. The office will be closed from December 24th to January 2nd, and all urgent inquiries should be directed to my email.

Please plan your work accordingly and let me know if there are any critical issues we need to address before the break.

Best regards,  
David`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-08T09:00:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "7",
    sender: {
      id: "7",
      name: "Olivia Chen",
      avatar: "/images/avatars/04.png",
      email: "olivia.chen@example.com",
      status: "Inactive",
    },
    subject: "Quarterly Earnings Report",
    content: `Dear Investors,

We are pleased to share with you our quarterly earnings report. This quarter showed significant growth in our revenue, and we are on track to meet our year-end goals. Please review the attached document for detailed figures, and don’t hesitate to reach out with any questions.

Looking forward to hearing your thoughts.

Best regards,  
Olivia`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-08T10:20:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: true,
  },
  {
    id: "8",
    sender: {
      id: "8",
      name: "Samuel Green",
      email: "samuel.green@example.com",
      status: "Active",
    },
    subject: "Customer Feedback Review",
    content: `Hello team,

Please find attached the latest batch of customer feedback. We have received a mix of positive and constructive comments, and I suggest we prioritize addressing the most common issues mentioned.

We want to continue improving our services and keeping customers happy. Please take a look and let me know your thoughts.

Best regards,  
Samuel`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-08T11:35:00Z"),
    label: "work",
    isDraft: true,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "9",
    sender: {
      id: "9",
      name: "Rachel Simmons",
      email: "rachel.simmons@example.com",
      status: "Active",
    },
    subject: "Project Milestone Achieved!",
    content: `Hi all,

I’m thrilled to announce that we’ve reached an important milestone in our project! The team has worked incredibly hard, and we’ve successfully completed phase one. 

Let’s keep up the momentum and stay focused as we move into the next phase. Thanks for all your hard work and dedication!

Best,  
Rachel`,
    read: true,
    starred: true,
    createdAt: new Date("2024-11-08T12:45:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "10",
    sender: {
      id: "10",
      name: "Michael Davis",
      email: "michael.davis@example.com",
      status: "Inactive",
    },
    subject: "Security Update Required",
    content: `Dear Users,

Please be informed that a critical security update is required for all systems by the end of this week. Failure to apply the update could result in vulnerabilities being exposed. 

Please visit our IT portal for instructions. If you need assistance, don’t hesitate to contact support.

Best regards,  
Michael`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-08T13:15:00Z"),
    label: "important",
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: true,
    isDeleted: false,
  },
  {
    id: "11",
    sender: {
      id: "11",
      name: "Alyssa Garner",
      email: "alyssa.garner@example.com",
      status: "Active",
    },
    subject: "Welcome to the Company!",
    content: `Dear New Employee,

Welcome aboard! We are excited to have you join our team. Please find attached the employee handbook, and don't forget to complete your onboarding paperwork. 

If you have any questions or need help settling in, don’t hesitate to reach out. We look forward to working with you!

Best,  
Alyssa`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-08T14:20:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "12",
    sender: {
      id: "12",
      name: "Ethan Price",
      email: "ethan.price@example.com",
      status: "Inactive",
    },
    subject: "Reminder: Subscription Renewal",
    content: `Dear Customer,

This is a reminder that your subscription will be renewing soon. If you wish to cancel or update your plan, please do so before the renewal date. 

If you have any questions or need assistance, our support team is here to help. Thank you for your continued support.

Best regards,  
Ethan`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-08T15:40:00Z"),
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: false,
    isDeleted: true,
  },
  {
    id: "13",
    sender: {
      id: "13",
      name: "Jessica Miles",
      email: "jessica.miles@example.com",
      status: "Active",
    },
    subject: "Invitation to Join Our Webinar",
    content: `Hi there!

We are hosting a free webinar next week, and we would love for you to join. The topic will be 'Mastering Digital Marketing for 2024'. It's a great opportunity to learn valuable strategies from industry experts. 

Click here to register, and we hope to see you there!

Best regards,  
Jessica`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-08T16:55:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "14",
    sender: {
      id: "14",
      name: "Brian Shaw",
      email: "brian.shaw@example.com",
      status: "Inactive",
    },
    subject: "System Maintenance Notification",
    content: `Dear Users,

Please be aware that our system will undergo maintenance this weekend from Friday 10:00 PM to Saturday 2:00 AM. During this time, there may be intermittent outages. 

We apologize for any inconvenience and encourage you to plan accordingly. Thank you for your understanding.

Best regards,  
Brian`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-08T17:10:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "15",
    sender: {
      id: "15",
      name: "Christina Yates",
      email: "christina.yates@example.com",
      status: "Active",
    },
    subject: "Thank You for Your Purchase!",
    content: `Dear Customer,

Thank you for your recent purchase! We're excited for you to enjoy your new product. If you have any questions about the product or need assistance with setup, our customer service team is here to help. 

Feel free to reach out anytime. Enjoy your purchase!

Best regards,  
Christina`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-08T18:25:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: true,
    isDeleted: false,
  },
  {
    id: "16",
    sender: {
      id: "16",
      name: "Jennifer Owens",
      email: "jennifer.owens@example.com",
      status: "Active",
    },
    subject: "Client Meeting Recap",
    content: `Hi team,

Just a quick recap from our meeting with the client this morning. They seemed really happy with the progress so far, but they want us to focus more on the user interface improvements for the next release. 

I’ve shared the notes with everyone; please check the shared folder for additional information.

Best,  
Jennifer`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-09T09:30:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "17",
    sender: {
      id: "17",
      name: "Victor Collins",
      email: "victor.collins@example.com",
      status: "Inactive",
    },
    subject: "Reminder: Team Outing This Weekend",
    content: `Hi all,

This is a reminder about our team outing this weekend. We’ll be meeting at the park on Saturday at 1:00 PM for a fun afternoon. There will be food, drinks, and a few team-building activities.

Let me know if you’re able to join or if you need any details. Looking forward to seeing everyone there!

Best,  
Victor`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T10:00:00Z"),
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "18",
    sender: {
      id: "18",
      name: "Sophia Wright",
      email: "sophia.wright@example.com",
      status: "Active",
    },
    subject: "Upcoming Webinar on Data Science",
    content: `Hi all,

We’re hosting a free webinar next week on the topic of Data Science and its applications in business. It will cover key concepts, trends, and case studies. 

Don’t miss this opportunity to learn from industry experts. Feel free to share the invite with colleagues who might be interested!

Cheers,  
Sophia`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T10:45:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "19",
    sender: {
      id: "19",
      name: "Paul Smith",
      email: "paul.smith@example.com",
      status: "Active",
    },
    subject: "Annual Review Schedule",
    content: `Dear colleagues,

It’s time for our annual performance reviews! Please check the HR portal to book a slot for your review session. The reviews will take place over the next two weeks.

If you have any questions or concerns, don’t hesitate to reach out. Looking forward to discussing your progress!

Best,  
Paul`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-09T11:00:00Z"),
    label: "work",
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "20",
    sender: {
      id: "20",
      name: "Mia Parker",
      avatar: "/images/avatars/01.png",
      email: "mia.parker@example.com",
      status: "Inactive",
    },
    subject: "Weekend Workshop on Personal Finance",
    content: `Hi everyone,

We’re hosting a weekend workshop on personal finance. If you want to learn how to better manage your money, this is a great opportunity to gain some useful insights.

Please let me know if you’d like to join. We’ll be covering budgeting, investing, and more.

Best regards,  
Mia`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-09T11:30:00Z"),
    isDraft: true,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "21",
    sender: {
      id: "21",
      name: "Lucas Thomas",
      avatar: "/images/avatars/04.png",
      email: "lucas.thomas@example.com",
      status: "Active",
    },
    subject: "Product Feedback Survey",
    content: `Hello,

We’d love to hear your thoughts on our recent product. Your feedback will help us improve and ensure we’re providing the best possible experience. The survey should only take a few minutes to complete.

Thank you in advance for your time!

Best,  
Lucas`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-09T12:00:00Z"),
    label: "personal",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "22",
    sender: {
      id: "22",
      name: "Oscar Lee",
      email: "oscar.lee@example.com",
      status: "Inactive",
    },
    subject: "Scheduled Maintenance Alert",
    content: `Dear Customer,

We will be conducting scheduled maintenance on our website this Saturday from 12:00 AM to 6:00 AM. During this time, our services may be temporarily unavailable.

We apologize for any inconvenience and appreciate your understanding.

Best regards,  
Oscar`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T13:00:00Z"),
    label: "important",
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "23",
    sender: {
      id: "23",
      name: "Zoe Adams",
      email: "zoe.adams@example.com",
      status: "Active",
    },
    subject: "Action Required: Tax Form Submission",
    content: `Hi there,

This is a reminder to submit your tax forms by the end of this week. If you have not yet submitted them, please complete the necessary paperwork as soon as possible to avoid any penalties.

Let me know if you need assistance.

Thanks,  
Zoe`,
    read: true,
    starred: true,
    createdAt: new Date("2024-11-09T13:30:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "24",
    sender: {
      id: "24",
      name: "James Bennett",
      email: "james.bennett@example.com",
      status: "Inactive",
    },
    subject: "Monthly Report Submission Reminder",
    content: `Hi team,

Just a quick reminder to submit your monthly reports by end of day Monday. We need all reports in order to prepare for the upcoming board meeting.

Please let me know if there are any issues with your submissions.

Best,  
James`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-09T14:00:00Z"),
    label: "work",
    isDraft: true,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "25",
    sender: {
      id: "25",
      name: "Carla Nguyen",
      email: "carla.nguyen@example.com",
      status: "Active",
    },
    subject: "Meeting Confirmation for Next Week",
    content: `Hello,

I just wanted to confirm the meeting scheduled for next week on Tuesday at 11:00 AM. Please make sure to attend, as we’ll be discussing important updates and upcoming projects.

Let me know if you need to reschedule.

Best regards,  
Carla`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-09T14:30:00Z"),
    label: "work",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "26",
    sender: {
      id: "26",
      name: "Daniel Harris",
      email: "daniel.harris@example.com",
      status: "Inactive",
    },
    subject: "Important: Insurance Claim Submission",
    content: `Dear customer,

This is an important reminder to submit your insurance claim by the deadline. If you need assistance with your claim, please reach out to our support team. We’re here to help!

Best regards,  
Daniel`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T15:00:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "27",
    sender: {
      id: "27",
      name: "Natalie Martin",
      email: "natalie.martin@example.com",
      status: "Active",
    },
    subject: "Website Design Proposal",
    content: `Hello,

I’ve attached the proposal for the website redesign project. Please review the document and provide any feedback before our meeting next Thursday.

I look forward to your thoughts.

Best,  
Natalie`,
    read: false,
    starred: false,
    createdAt: new Date("2024-11-09T15:30:00Z"),
    label: "work",
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "28",
    sender: {
      id: "28",
      name: "Henry Green",
      email: "henry.green@example.com",
      status: "Inactive",
    },
    subject: "Job Application Status Update",
    content: `Dear applicant,

Thank you for your interest in the position at our company. After careful review, we regret to inform you that we have decided to move forward with another candidate.

We appreciate your time and wish you the best in your job search.

Best regards,  
Henry`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T16:00:00Z"),
    label: "personal",
    isDraft: false,
    isSent: false,
    isStarred: false,
    isSpam: false,
    isDeleted: true,
  },
  {
    id: "29",
    sender: {
      id: "29",
      name: "Olivia Clark",
      email: "olivia.clark@example.com",
      status: "Active",
    },
    subject: "Reminder: Event Registration Deadline",
    content: `Hi there,

Just a reminder that the registration deadline for our upcoming event is this Friday. Please make sure to sign up if you plan to attend.

We look forward to seeing you there!

Best regards,  
Olivia`,
    read: false,
    starred: true,
    createdAt: new Date("2024-11-09T16:30:00Z"),
    label: "important",
    isDraft: false,
    isSent: false,
    isStarred: true,
    isSpam: false,
    isDeleted: false,
  },
  {
    id: "30",
    sender: {
      id: "30",
      name: "Liam Foster",
      email: "liam.foster@example.com",
      status: "Inactive",
    },
    subject: "Holiday Schedule Confirmation",
    content: `Hi team,

I just wanted to confirm the holiday schedule for the upcoming month. Please let me know if there are any changes, as I need to finalize the roster.

Thanks for your cooperation!

Best regards,  
Liam`,
    read: true,
    starred: false,
    createdAt: new Date("2024-11-09T17:00:00Z"),
    label: "work",
    isDraft: false,
    isSent: true,
    isStarred: false,
    isSpam: false,
    isDeleted: false,
  },
];
