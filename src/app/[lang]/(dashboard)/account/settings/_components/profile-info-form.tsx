"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { Locale } from "@/configs/i18n";

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

const FormSchema = z.object({
  first_name: z
    .string()
    .min(2, { message: "First Name must contain at least 2 character(s)" }),
  last_name: z
    .string()
    .min(2, { message: "Last Name must contain at least 2 character(s)" }),
  username: z
    .string()
    .min(3, { message: "Username must contain at least 3 character(s)" }),
  email: z.string().email(),
  phone_number: z
    .string()
    .min(10, { message: "Phone Number must be at least 10 digits" }),
  state: z.string(),
  country: z.string(),
  address: z.string(),
  zip_code: z
    .string()
    .min(5, { message: "Zip Code must be at least 5 digits" }),
  language: z.string(),
  time_zone: z.string(),
  currency: z.string(),
  organization: z.string().optional(),
  avatar: z
    .any()
    .optional()
    .refine(
      (file) =>
        file === null || file === undefined || file.size <= 2 * 1024 * 1024,
      "Max file size is 2MB"
    )
    .refine(
      (file) =>
        file === null ||
        file === undefined ||
        [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/svg+xml",
          "image/webp",
          "image/jpg",
        ].includes(file.type),
      "Only JPEG, PNG, GIF, SVG, and WebP files are allowed"
    ),
});

interface ProfileInfoFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: Locale;
  profile: any;
}

export function ProfileInfoForm({
  className,
  locale,
  profile,
  ...props
}: ProfileInfoFormProps) {
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...profile,
    },
  });
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(
    profile?.avatar
  );

  const isLoading = form.formState.isSubmitting;

  async function onSubmit(data: z.infer<typeof FormSchema>) {}

  function handleResetForm() {
    form.reset(profile);
    setPhotoPreview(profile?.avatar || null);
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
              <AvatarImage src={photoPreview || ""} alt="Profile Avatar" />
              <AvatarFallback>{profile.first_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2 md:flex-row">
              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPhotoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setPhotoPreview(null);
                          }
                          form.setValue("avatar", file);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  form.setValue("avatar", null);
                  setPhotoPreview(null);
                }}
              >
                Remove Photo
              </Button>
            </div>
          </div>
          <FormField
            control={form.control}
            name="first_name"
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
            name="last_name"
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
            name="phone_number"
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
            name="zip_code"
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
            name="time_zone"
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
          <Button type="submit" className="w-fit" disabled={isLoading}>
            {isLoading && <LoaderCircle className="me-2 size-4 animate-spin" />}
            Save
          </Button>
          <Button
            type="reset"
            variant="secondary"
            className="w-fit"
            disabled={isLoading}
            onClick={handleResetForm}
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}
