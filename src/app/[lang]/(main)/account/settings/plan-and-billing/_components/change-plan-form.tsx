"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Briefcase,
  Users,
  FileText,
  BarChart2,
  Check,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FormSchema = z.object({
  plan: z.enum(["Starter", "Business", "Enterprise"], {
    required_error: "You need to select a plan option.",
  }),
  interval: z.boolean().default(false).optional(),
});

export function ChangePlanForm({ plans, subscriptions }) {
  const lastSubscribedPlan = plans.find(
    (p) => p.id === subscriptions[0].plan_id
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      plan: lastSubscribedPlan.name,
      interval: subscriptions[0].interval === "yearly",
    },
  });

  const isAnnual = form.watch("interval");

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast({
      title: "You submitted the following values:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="interval"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FormLabel className="font-bold"></FormLabel>
                  <Label htmlFor="annual-billing">
                    Annual billing (Save 15%)
                  </Label>
                </div>
              </FormControl>
              <FormDescription>
                Toggle if you want to select nnual
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid gap-2"
                >
                  {plans.map((plan) => (
                    <FormItem key={plan.name} className="relative">
                      <FormControl className="absolute top-4 end-4">
                        <RadioGroupItem value={plan.name} />
                      </FormControl>
                      <FormLabel className="cursor-pointer h-full">
                        <Card
                          className={cn(
                            "h-full",
                            field.value === plan.name && "border-primary"
                          )}
                        >
                          <CardHeader>
                            <CardTitle>{plan.name}</CardTitle>
                            <CardDescription>
                              $
                              {isAnnual
                                ? Math.round((plan.price * 12 * 0.85) / 12)
                                : plan.price}
                              /month
                              {isAnnual && (
                                <span className="ml-2 text-green-500">
                                  Save $
                                  {Math.round((plan.price * 12 * 0.15) / 12)}
                                  /month
                                </span>
                              )}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ul className="list-disc ps-4 space-y-1">
                              {plan.features.map((feature, index) => (
                                <li key={index} className="text-sm">
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormDescription>
                Select your desired plan by clicking on its card
              </FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
