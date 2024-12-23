"use client";

import * as React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";

import { getTeamMembersSearchData } from "../_actions/get-team-members-search-data";
import { KanbanTaskSchema } from "../_schemas/kanban-task-schema";
import { UserSchema } from "../_schemas/user-schema";

import { cn } from "@/lib/utils";
import { useActionState } from "@/hooks/use-action-state";

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
type TeamMemberType = z.infer<typeof UserSchema>;

export function AssignedFormField({ form }: { form: UseFormReturn<FormType> }) {
  const [searchTeamMembers, setSearchTeamMembers] = React.useState("");
  const [
    searchTeamMembersResults,
    searchTeamMembersAction,
    searchTeamMembersIsPending,
  ] = useActionState<string, TeamMemberType[]>(getTeamMembersSearchData, []);

  // Debounce the search action to optimize API calls
  const debouncedSearch = React.useMemo(() => {
    let handler: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(handler);
      handler = setTimeout(() => searchTeamMembersAction(value), 300);
    };
  }, [searchTeamMembersAction]);

  // Memoize the assigned team member IDs
  const assigned = form.watch("assigned");
  const assignedIds = React.useMemo(
    () => new Set(assigned?.map((m) => m.id)),
    [assigned]
  );

  // Render the list of team members
  const renderCommandItems = () => {
    if (searchTeamMembersIsPending) {
      return (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="size-4 text-muted-foreground animate-spin" />
        </div>
      );
    }

    return searchTeamMembersResults
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
                  {searchTeamMembersResults.length === 0 &&
                    !searchTeamMembersIsPending && (
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
