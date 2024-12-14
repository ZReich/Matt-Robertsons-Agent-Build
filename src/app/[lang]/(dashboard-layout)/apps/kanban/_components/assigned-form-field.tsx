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

  const assigned = form.watch("assigned");
  const assignedIds = new Set(assigned?.map((m) => m.id)); // Create a Set of assigned team member IDs for efficient lookups

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
                    searchTeamMembersAction(value);
                  }}
                />
                <CommandList
                  aria-hidden={!!searchTeamMembers}
                  className={cn(!!searchTeamMembers ? "block" : "hidden")}
                >
                  {searchTeamMembersIsPending ? (
                    <div className="flex justify-center items-center py-6">
                      <Loader2 className="size-4 text-muted-foreground animate-spin" />
                    </div>
                  ) : (
                    <CommandEmpty>No team members found.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {!searchTeamMembersIsPending &&
                      searchTeamMembersResults
                        .filter((member) => !assignedIds.has(member.id))
                        .map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => {
                              field.onChange([...field.value, user]);
                              setSearchTeamMembers("");
                            }}
                          >
                            {user.name}
                          </CommandItem>
                        ))}
                  </CommandGroup>
                </CommandList>
              </Command>

              <div className="flex flex-wrap gap-2 mt-2">
                {field.value.map((user) => {
                  return (
                    user && (
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
                            field.onChange(
                              field.value.filter((m) => m.id !== user.id)
                            )
                          }
                          aria-label="Remove"
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    )
                  );
                })}
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
