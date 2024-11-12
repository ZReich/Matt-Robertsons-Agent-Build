"use client";

import * as React from "react";
import { z } from "zod";
import { EllipsisVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCardBrandIcon } from "@/components/CreditCardBrandIcon";
import { Badge } from "@/components/ui/badge";

const cardSchema = z.object({
  id: z.number().int().positive(),
  last4: z
    .string()
    .length(4, { message: "last4 must be exactly 4 characters" }),
  type: z.enum(["visa", "mastercard", "amex", "discover"]),
  default: z.boolean(),
});

type Card = z.infer<typeof cardSchema>;

export function SavedCardsList() {
  const data: Card[] = [
    { id: 1, last4: "4242", type: "visa", default: true },
    { id: 2, last4: "5678", type: "mastercard", default: false },
  ];

  return (
    <ul className="space-y-2">
      {data.map((card) => (
        <li
          key={card.last4}
          className="flex justify-between items-center gap-8 space-y-0 px-4 py-2 border rounded-md shadow"
        >
          <h4 className="flex justify-center items-center gap-2">
            <CreditCardBrandIcon brandName={card.type} />
            <span>**** **** **** {card.last4}</span>
            {card.default && <Badge>default</Badge>}
          </h4>
          <div>
            <MenuButton card={card} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MenuButton({ card }: { card: Card }) {
  function handleSetDefault(id: number) {}

  function handleDelete(id: number) {}

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onClick={() => handleSetDefault(card.id)}
          className="cursor-pointer"
          disabled={card.default}
        >
          Set Default
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDelete(card.id)}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
