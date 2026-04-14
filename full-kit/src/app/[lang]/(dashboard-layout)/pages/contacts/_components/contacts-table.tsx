"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, ChevronUp, Search } from "lucide-react"

import type { ColumnDef, SortingState } from "@tanstack/react-table"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface ContactRow {
  slug: string
  name: string
  role: string
  company: string
  phone: string
  email: string
  address: string
}

interface ContactsTableProps {
  contacts: ContactRow[]
}

export function ContactsTable({ contacts }: ContactsTableProps) {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) ?? "en"

  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<ContactRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3.5" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ArrowUpDown className="size-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            {row.original.company && (
              <p className="text-xs text-muted-foreground">
                {row.original.company}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role / Relationship",
        cell: ({ getValue }) => (
          <span className="text-sm">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => {
          const v = getValue() as string
          return v ? (
            <a
              href={`mailto:${v}`}
              className="text-sm text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {v}
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )
        },
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: contacts,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  })

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search contacts…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-muted-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/${lang}/pages/contacts/${row.original.slug}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No contacts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} of {contacts.length} contacts
      </p>
    </div>
  )
}
