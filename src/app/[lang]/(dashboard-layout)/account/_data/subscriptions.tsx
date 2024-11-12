import { Subscription } from "../types";

export const subscriptionsData: Subscription[] = [
  {
    id: 1,
    plan_id: 1,
    interval: "monthly",
    start_date: "2024-09-01T10:30:00.000Z",
    end_date: "2024-10-01T10:30:00.000Z",
    status: "active",
  },
  {
    id: 2,
    plan_id: 2,
    interval: "monthly",
    start_date: "2024-09-02T11:00:00.000Z",
    end_date: "2024-10-02T11:00:00.000Z",
    status: "active",
    created_at: "2024-09-02T11:00:00.000Z",
    updated_at: "2024-09-02T11:00:00.000Z",
  },
  {
    id: 3,
    plan_id: 3,
    interval: "monthly",
    start_date: "2023-09-01T11:30:00.000Z",
    end_date: "2024-09-01T11:30:00.000Z",
    status: "expired",
    created_at: "2023-09-01T11:30:00.000Z",
    updated_at: "2024-09-01T11:30:00.000Z",
  },
];
