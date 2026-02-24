/**
 * Zod request validation schemas for API routes.
 * Use schema.safeParse(body) and return 400 with result.error.flatten().fieldErrors when !result.success.
 */

import { z } from "zod";
import { normalizeWebsiteUrl } from "@/lib/utils";

export const analyzeSchema = z
  .object({
    url: z.string().min(1, "URL is required").max(2048),
  })
  .transform((data) => ({ url: normalizeWebsiteUrl(data.url) }));

export const requestQuoteSchema = z.object({
  refreshId: z.string().cuid("Invalid analysis ID"),
  layoutIndex: z.number().int().min(1).max(6).optional(),
  email: z.string().email("Invalid email").max(255),
  phone: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
  platform: z.string().max(50).optional(),
});

export const requestInstallSchema = z.object({
  refreshId: z.string().cuid("Invalid analysis ID"),
  layoutIndex: z.number().int().min(1).max(6).optional(),
  email: z.string().email("Invalid email").max(255),
  phone: z.string().max(20),
  hostingPlatform: z.string().max(50).optional(),
  hasCredentialsReady: z.boolean().optional(),
  preferredTime: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const exportSchema = z.object({
  refreshId: z.string().cuid("Invalid analysis ID"),
  layoutIndex: z.number().int().min(1).max(6).optional(),
  platform: z.enum(["html", "wordpress", "squarespace", "wix"]),
  token: z.string().min(1, "Token is required"),
});

export const adminNotesSchema = z.object({
  authorName: z.string().min(1, "authorName is required").max(100),
  content: z.string().min(1, "content is required").max(10000),
  category: z.string().max(50).optional(),
});

export const benchmarkCreateSchema = z.object({
  url: z.string().url().min(1),
  industry: z.string().min(1).max(100),
});

export const benchmarkNotesSchema = z.object({
  authorName: z.string().min(1).max(100),
  content: z.string().min(1).max(10000),
  category: z.string().max(50).optional(),
});
