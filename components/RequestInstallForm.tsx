"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

const PLATFORMS = ["Squarespace", "WordPress", "Wix", "Other"] as const;
const PREFERRED_TIMES = ["Morning", "Afternoon", "Evening"] as const;

const installFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  hostingPlatform: z
    .string()
    .min(1, "Please select your hosting platform")
    .refine((v) => PLATFORMS.includes(v as (typeof PLATFORMS)[number])),
  hasCredentialsReady: z.boolean().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().optional(),
});

type InstallFormValues = z.infer<typeof installFormSchema>;

interface RequestInstallFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  layoutIndex?: number;
}

export function RequestInstallForm({
  open,
  onOpenChange,
  analysisId,
  layoutIndex,
}: RequestInstallFormProps) {
  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installFormSchema),
    defaultValues: {
      email: "",
      phone: "",
      hostingPlatform: "",
      hasCredentialsReady: false,
      preferredTime: "",
      notes: "",
    },
  });

  const onSubmit = async (values: InstallFormValues) => {
    try {
      const body: Record<string, unknown> = {
        analysisId,
        email: values.email.trim(),
        phone: values.phone.trim(),
        hostingPlatform: values.hostingPlatform,
        hasCredentialsReady: values.hasCredentialsReady ?? false,
        preferredTime: values.preferredTime || undefined,
        notes: values.notes?.trim() || undefined,
      };
      if (layoutIndex === 1 || layoutIndex === 2 || layoutIndex === 3) {
        body.layoutIndex = layoutIndex;
      }
      const res = await fetch("/api/request-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      toast.success(
        "Thanks! We'll reach out within 24 hours to schedule your 15-min install."
      );
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const layoutLabel =
    layoutIndex === 1 || layoutIndex === 2 || layoutIndex === 3
      ? `Layout ${layoutIndex}`
      : "your chosen layout";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request installation</DialogTitle>
          <DialogDescription>
            We&apos;ll install {layoutLabel} for you. +$250
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
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
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hostingPlatform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hosting platform *</FormLabel>
                  <FormControl>
                    <select
                      className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      {...field}
                      value={field.value ?? ""}
                    >
                      <option value="">Select...</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hasCredentialsReady"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Have hosting credentials ready?
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferredTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred time</FormLabel>
                  <FormControl>
                    <select
                      className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      {...field}
                      value={field.value ?? ""}
                    >
                      <option value="">Select...</option>
                      {PREFERRED_TIMES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <textarea
                      className={cn(
                        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      placeholder="Any specific requests..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Sending..."
                  : "Request Installation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
