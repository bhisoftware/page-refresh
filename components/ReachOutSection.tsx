"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

const reachOutFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type ReachOutFormValues = z.infer<typeof reachOutFormSchema>;

interface ReachOutSectionProps {
  refreshId: string;
  viewToken: string;
}

export function ReachOutSection({ refreshId, viewToken }: ReachOutSectionProps) {
  const form = useForm<ReachOutFormValues>({
    resolver: zodResolver(reachOutFormSchema),
    defaultValues: { firstName: "", email: "" },
  });

  const onSubmit = async (values: ReachOutFormValues) => {
    try {
      const res = await fetch("/api/reach-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshId,
          token: viewToken,
          email: values.email.trim(),
          firstName: values.firstName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      toast.success("Thanks! We'll be in touch soon.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col items-center space-y-2">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem className="w-full max-w-xs">
              <FormLabel>First name *</FormLabel>
              <FormControl>
                <Input placeholder="Your first name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full max-w-xs">
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="default"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Sending..." : "Reach out"}
        </Button>
      </form>
    </Form>
  );
}
