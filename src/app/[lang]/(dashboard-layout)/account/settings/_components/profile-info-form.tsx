"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import { ProfileInfoSchema } from "../_schemas/profile-info-form";

import { cn, getInitials } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";
import type { UserType } from "../../types";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FormType = z.infer<typeof ProfileInfoSchema>;

interface ProfileInfoFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
  user: UserType;
}

export function ProfileInfoForm({
  className,
  locale,
  user,
  ...props
}: ProfileInfoFormProps) {
  const form = useForm<FormType>({
    resolver: zodResolver(ProfileInfoSchema),
    defaultValues: {
      ...user,
      avatar: undefined,
    },
  });
  const [photoPreview, setPhotoPreview] = React.useState<string | undefined>(
    user?.avatar
  );

  const { isSubmitting, isValid, isDirty } = form.formState;
  const isDisabled = isSubmitting || !isDirty || !isValid; // Disable button if form is invalid, unchanged, or submitting

  async function onSubmit(data: FormType) {}

  function handleResetForm() {
    form.reset(); // Reset the form to the initial state
    setPhotoPreview(user?.avatar); // Reset photoPreview to the initial state
  }

  function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    // Get the selected file from the file input
    const file = e.target.files?.[0];

    if (file) {
      // Generate a temporary URL for the uploaded image for preview purposes
      const imageUrl = URL.createObjectURL(file);

      setPhotoPreview(imageUrl);
      form.setValue("avatar", file);
      form.trigger("avatar"); // Trigger validation for the "avatar" field
    }
  }

  function handleRemovePhoto() {
    form.resetField("avatar"); // Reset the "avatar" field in the form to its initial state
    setPhotoPreview(undefined);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("grid gap-6", className)}
        {...props}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="col-span-2 flex items-center gap-4 mb-4">
            <Avatar className="size-24">
              <AvatarImage src={photoPreview} alt="Profile Avatar" />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2 md:flex-row">
              <FormField
                control={form.control}
                name="avatar"
                render={() => (
                  <FormItem>
                    <FormLabel
                      className={cn(
                        buttonVariants({ variant: "default" }),
                        "cursor-pointer w-full"
                      )}
                    >
                      Upload Photo
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadPhoto}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemovePhoto}
              >
                Remove Photo
              </Button>
            </div>
          </div>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="grow">
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="grow">
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="john_doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="California" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="USA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zip Code</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="90210" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Language</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="English" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timeZone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Zone</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="GMT-7" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="USD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="organization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization (Optional)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Company Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-x-2">
          <Button
            type="submit"
            className="w-fit"
            disabled={isDisabled}
            aria-live="assertive"
          >
            {isSubmitting && (
              <LoaderCircle
                className="me-2 size-4 animate-spin"
                aria-label="Loading"
              />
            )}
            Save
          </Button>
          <Button
            type="reset"
            variant="secondary"
            className="w-fit"
            disabled={isDisabled}
            onClick={handleResetForm}
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}
