"use client";

import * as React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { X } from "lucide-react";

import { KanbanTaskSchema } from "../../_schemas/kanban-task-schema";

import { cn } from "@/lib/utils";

import { useKanbanContext } from "../../hooks/use-kanban-context";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type FormType = z.infer<typeof KanbanTaskSchema>;

export function AssignedFormField({ form }: { form: UseFormReturn<FormType> }) {
  const { kanbanState, handleGetTeamMembersBySearchTerm } = useKanbanContext();
  const [searchTeamMembers, setSearchTeamMembers] = React.useState("");

  // Debounce the search action to optimize API calls
  const debouncedSearch = React.useMemo(() => {
    let handler: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(handler);
      handler = setTimeout(() => handleGetTeamMembersBySearchTerm(value), 300);
    };
  }, [handleGetTeamMembersBySearchTerm]);

  const assigned = form.watch("assigned");
  // Memoize the assigned team member IDs
  const assignedIds = React.useMemo(
    () => new Set(assigned?.map((m) => m.id)),
    [assigned]
  );
  const { selectedTeamMembers } = kanbanState;

  // Render the list of team members
  const renderCommandItems = () => {
    return selectedTeamMembers
      .filter((member) => !assignedIds.has(member.id))
      .map((user) => (
        <CommandItem
          key={user.id}
          onSelect={() => {
            form.setValue("assigned", [...assigned, user]);
            setSearchTeamMembers("");
          }}
        >
          {user.name}
        </CommandItem>
      ));
  };

  // Render badges for the assigned team members
  const renderBadges = () =>
    assigned.map((user) => (
      <Badge
        key={user.id}
        variant="secondary"
        className="flex items-center gap-1"
      >
        {user.name}
        <Button
          variant="ghost"
          size="icon"
          className="size-fit"
          onClick={() =>
            form.setValue(
              "assigned",
              assigned.filter((m) => m.id !== user.id)
            )
          }
          aria-label="Remove"
        >
          <X className="size-3" />
        </Button>
      </Badge>
    ));

  return (
    <FormField
      control={form.control}
      name="assigned"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Assigned Team Members</FormLabel>
          <FormControl>
            <div>
              <Command className="rounded-md border">
                <CommandInput
                  className="h-9"
                  placeholder="Search team members..."
                  value={searchTeamMembers}
                  onValueChange={(value) => {
                    setSearchTeamMembers(value);
                    debouncedSearch(value);
                  }}
                  aria-live="polite"
                />
                <CommandList
                  aria-hidden={!!searchTeamMembers}
                  className={cn(!!searchTeamMembers ? "block" : "hidden")}
                >
                  {selectedTeamMembers.length === 0 && (
                    <CommandEmpty>No team members found.</CommandEmpty>
                  )}
                  <CommandGroup>{renderCommandItems()}</CommandGroup>
                </CommandList>
              </Command>

              <div className="flex flex-wrap gap-2 mt-2">{renderBadges()}</div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
