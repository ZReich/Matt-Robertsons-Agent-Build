import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const logs = [
  {
    id: "1",
    device: "iPhone 14 Pro",
    location: "New York, USA",
    created_at: "2024-09-08T10:15:30Z",
    userAgent: "Safari on iOS",
  },
  {
    id: "2",
    device: "MacBook Pro",
    location: "San Francisco, USA",
    created_at: "2024-09-07T15:45:00Z",
    userAgent: "Safari on macOS",
  },
  {
    id: "3",
    device: "Samsung Galaxy S23",
    location: "London, UK",
    created_at: "2024-09-07T11:30:45Z",
    userAgent: "Chrome on Android",
  },
  {
    id: "4",
    device: "Dell XPS 13",
    location: "Berlin, Germany",
    created_at: "2024-09-06T08:20:15Z",
    userAgent: "Chrome on Windows",
  },
  {
    id: "5",
    device: "iPad Air",
    location: "Toronto, Canada",
    created_at: "2024-09-05T18:05:30Z",
    userAgent: "Safari on iOS",
  },
  {
    id: "6",
    device: "Google Pixel 7",
    location: "Sydney, Australia",
    created_at: "2024-09-04T22:10:00Z",
    userAgent: "Chrome on Android",
  },
];

export function RecentLogsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User Agent</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{log.userAgent}</TableCell>
            <TableCell>{log.device}</TableCell>
            <TableCell>{log.location}</TableCell>
            <TableCell>
              {format(new Date(log.created_at), "dd/MM/yyyy hh:mm a")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
